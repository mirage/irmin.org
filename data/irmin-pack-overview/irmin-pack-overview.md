# Documentation for Irmin-pack

This document describes the high-level functioning of Irmin-pack.

[TOC]



## Overview

### Irmin-pack

Irmin-pack is an Irmin backend store. 

```
(s.ml)
module type S = sig
  include Irmin.Generic_key.S
  ...[extra stuff related to on-disk behaviour, syncing, stats, etc]...
```

In Irmin, `Generic_key.S` is the type of "generic key stores". 

Then `irmin_pack_intf.ml` then defines `module Maker : Maker_persistent` where `Maker_persistent` is a functor that ultimately (given a config and an "extended schema") gives a module of type `S`.

### Irmin Schema

In order to construct Irmin stores, you typically need a "schema". In Irmin, this is defined (`schema.ml`) as:

```
module type S = sig
  module Hash : Hash.S
  module Branch : Branch.S
  module Info : Info.S
  module Metadata : Metadata.S
  module Path : Path.S
  module Contents : Contents.S
end
```

Hash provides a uniform notion of hash. A branch is similar to a git branch. Info is extra information for a commit. Metadata is "node metadata", i.e. something that can be attached to a node. Path is normally a list of strings. Contents is normally just bytes.

An extended schema (same file) defines extra functors `Node` and `Commit`. Node corresponds to a git tree object. Similarly, commit corresponds to a git commit object.

### Irmin-pack files

To implement the store, there are various files involved: **store.pack, store.branches, store.dict**:

```
(layout.ml)
let pack = toplevel "store.pack"
let branch = toplevel "store.branches"
let dict = toplevel "store.dict"
let stores ~root = [ pack ~root; branch ~root; dict ~root ]
```

Of these, store.pack and store.dict are the most important.

In addition, there is the "index" which is sufficiently complicated to have its own github repo: mirage/index

**Index files:**

```
(pack_index_intf.ml)
module type S = sig
  include Index.S with type value = int63 * int * Pack_value.Kind.t
  ...

module type Sigs = sig
  module type S = S

  module Make (K : Irmin.Hash.S) : S with type key = K.t (* ! *)
end
```

NOTE the `!` which defines the index key type as an Irmin hash.

The index allows you to locate certain objects in the pack file. The index is essentially a key-value store, mapping keys (hashes which represent objects) to locations within the pack file (offset, length, kind). In earlier iterations, all objects within the pack file were indexed. Now, only a subset of the objects (just the commits) are indexed. For index, we have:

```
(layout.ml)
let log = toplevel "log"
let log_async = toplevel "log_async"
let data = toplevel "data"
let lock = toplevel "lock"
let merge = toplevel "merge"
```

In current irmin-pack, we index only commits. We can probably ignore the exact behaviour of the index and treat it as a generic map from commit object hash to $(offset,length)$.



## Particular files: store.branches and store.dict

### store.branches (Layout.branch) format

FIXME not clear where this info is stored; there is a reference to Layout.branch in `atomic_write.ml`.

### store.dict format

The dictionary is an on-disk map from string to int. The idea is that we can avoid repeatedly writing a long string by instead writing a much smaller int, and using the dictionary when we want to recover the actual string.

```
(dict_intf.ml)
module type S = sig
  type t

  val find : t -> int -> string option
  val index : t -> string -> int option
  ...
```

The function `index` really "interns" a string to an int, see https://en.wikipedia.org/wiki/String_interning. There is a max dictionary capacity (number of strings that can be interned as ints). After this, the `index` function will return `None`. The current capacity limit is 100k.

FIXME to avoid name/concept clash with the index, we should probably rename `Dict.index`.

The format of the dictionary is just a sequence of entries of the form $(len,string)$, where string is the interned string and len is the length of the interned string, expressed as an int32. The sequence number of the entry is the int that corresponds to the string.

NOTE probably we should only intern reasonably long strings; the current `dict.ml` code doesn't seem to do this.

**Where is the dictionary used?** 

```
(pack_store.ml)
  type 'a t = {
    block : IO.t;
    index : Index.t;
    indexing_strategy : Indexing_strategy.t;
    dict : Dict.t;
    mutable open_instances : int;
  }
```

Then later we have:

```
(pack_store.ml)
module Make_without_close_checks
      (Val : Pack_value.Persistent with type hash := K.t and type key := Key.t) =
    ...
    let io_read_and_decode ~off ~len t =
      ...
      let dict = Dict.find t.pack.dict in
      Val.decode_bin ~key_of_offset ~key_of_hash ~dict
        (Bytes.unsafe_to_string buf)
        (ref 0)
```

And similarly in `unsafe_append`:

```
        let dict = Dict.index t.pack.dict in
        let off = IO.offset t.pack.block in
        Val.encode_bin ~offset_of_key ~dict hash v (IO.append t.pack.block);
```

Thus, dictionary is passed explicitly to the decode/encode functions, which are presumably supposed to know how to make use of them. NOTE that `Val` is of type `Pack_value.Persistent`.



## Structure of the pack file

### Pack values

The pack store contains a sequence (?) of pack values. 

```
(pack_store_intf.ml)
module type S = sig
  include Indexable.S
  ...
```

And 

```
(indexable_intf.ml)
module type S = sig
  include Irmin.Indexable.S

  val add : 'a t -> value -> key Lwt.t
  (** Overwrite [add] to work with a read-only database handler. *)

  val unsafe_add : 'a t -> hash -> value -> key Lwt.t
  (** Overwrite [unsafe_add] to work with a read-only database handler. *)
  ...
```

NOTE type `'a t` is the type of the store. FIXME why can `add` work with a read-only store?

Here, type `value` is used as a `Pack_value.Persistent.t`.

```
(pack_value_intf.ml)
type length_header = [ `Varint ] option

module type S = sig
  include Irmin.Type.S

  type hash
  type key
  type kind

  val hash : t -> hash
  val kind : t -> kind

  val length_header : kind -> length_header
  (** Describes the length header formats for the {i data} sections of pack
      entries. *)

  val encode_bin :
    dict:(string -> int option) ->
    offset_of_key:(key -> int63 option) ->
    hash ->
    t Irmin.Type.encode_bin

  val decode_bin :
    dict:(int -> string option) ->
    key_of_offset:(int63 -> key) ->
    key_of_hash:(hash -> key) ->
    t Irmin.Type.decode_bin

  val decode_bin_length : string -> int -> int
end

module type Persistent = sig
  type hash

  include S with type hash := hash and type key = hash Pack_key.t
end
```

FIXME we should comment this file further

The encoding and decoding of these values -- via `encode_bin` and `decode_bin` -- is somewhat complicated.

Let's first look at the kinds of object:

```
(pack_value_intf.ml)
  module Kind : sig
    type t =
      | Commit_v1
      | Commit_v2
      | Contents
      | Inode_v1_unstable
      | Inode_v1_stable
      | Inode_v2_root
      | Inode_v2_nonroot
    [@@deriving irmin]
    ...
    val to_magic : t -> char
```

Here, there is a "magic char" associated with each type of object that can occur in the pack file.

```
(pack_value.ml)
  let to_magic = function
    | Commit_v1 -> 'C'
    | Commit_v2 -> 'D'
    | Contents -> 'B'
    | Inode_v1_unstable -> 'I'
    | Inode_v1_stable -> 'N'
    | Inode_v2_root -> 'R'
    | Inode_v2_nonroot -> 'O'
```

OK. So what does the encoding of a particular pack value actually look like? 

**Encoding/decoding of contents** In `pack_value.ml` there is code for dealing with contents and commit objects. For contents we have: 

```
(pack_value.ml)
type ('h, 'a) value = { hash : 'h; kind : Kind.t; v : 'a } [@@deriving irmin]
...
module Of_contents ... =
struct
  ...
  let encode_bin ~dict:_ ~offset_of_key:_ hash v f =
    encode_value { kind; hash; v } f

  let decode_bin ~dict:_ ~key_of_offset:_ ~key_of_hash:_ s off =
    let t = decode_value s off in
    t.v

  let decode_bin_length = get_dynamic_sizer_exn value
```

NOTE that the code relies on values of type `('h,'a)value` being written out as `hash` followed by `kind` followed by `v` (this can be seen, for example, in later code which tries to access the kind tag by adding the hash length to a given offset).

**Important point:** All encoded values in the pack file start with the hash, followed by a kind magic char: `[hash|kind_char|...]`

NOTE that `get_dynamic_sizer_exn` is a way to establish the length of an encoding, typically fixed/static (for example, all objects of a given type might have a fixed length encoding as bytes), or dynamic (looking at the data at a given point in a file, where an object has been encoded, we can work out the length... perhaps by just decoding it and seeing which bytes we consume... which might be quite expensive), or possibly "unknown":

```
(pack_value.ml)
let get_dynamic_sizer_exn : type a. a Irmin.Type.t -> string -> int -> int =
 fun typ ->
  match Irmin.Type.(Size.of_encoding typ) with
  | Unknown ->
      Fmt.failwith "Type must have a recoverable encoded length: %a"
        Irmin.Type.pp_ty typ
  | Static n -> fun _ _ -> n
  | Dynamic f -> f
```

**Encoding/decoding of commits** 

There are two versions of commit objects (from the kinds listed above, `Commit_v1` and `Commit_v2`). For a `Commit_v2` we have:

```
(pack_value.ml)
      type data = { length : int; v : Commit_direct.t } [@@deriving irmin]
      type t = (hash, data) value [@@deriving irmin ~encode_bin ~decode_bin]
```

That is, commits are encoded as: `[hash|kind_char|len|Commit_direct.t encoding]`

What about the encoding of the other objects, like `Inode_v2` etc?




### Pack values and the store.pack format

**What is Val?** 

```
(pack_store.ml)
  module Make_without_close_checks
      (Val : Pack_value.Persistent with type hash := K.t and type key := Key.t) =
```





