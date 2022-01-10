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

The pack store contains a sequence of pack values. 

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

  val index_direct : _ t -> hash -> key option

  val unsafe_append :
    ensure_unique:bool -> overcommit:bool -> 'a t -> hash -> value -> key

  val unsafe_mem : 'a t -> key -> bool
  val unsafe_find : check_integrity:bool -> 'a t -> key -> value option
end
```

And 

```
(irmin/.../indexable_intf.ml)
module type S_without_key_impl = sig
  include Read_only.S
  (** @inline *)

  type hash
  (** The type of hashes of [value]. *)

  val add : [> write ] t -> value -> key Lwt.t
  (** Write the contents of a value to the store, and obtain its key. *)

  val unsafe_add : [> write ] t -> hash -> value -> key Lwt.t
  (** Same as {!add} but allows specifying the value's hash directly. The
      backend might choose to discard that hash and/or can be corrupt if the
      hash is not consistent. *)

  val index : [> read ] t -> hash -> key option Lwt.t
  (** Indexing maps the hash of a value to a corresponding key of that value in
      the store. For stores that are addressed by hashes directly, this is
      typically [fun _t h -> Lwt.return (Key.of_hash h)]; for stores with more
      complex addressing schemes, [index] may attempt a lookup operation in the
      store.

      In general, indexing is best-effort and reveals no information about the
      membership of the value in the store. In particular:

      - [index t hash = Some key] doesn't guarantee [mem t key]: the value with
        hash [hash] may still be absent from the store;

      - [index t hash = None] doesn't guarantee that there is no [key] such that
        [mem t key] and [Key.to_hash key = hash]: the value may still be present
        in the store under a key that is not indexed. *)

  include Clearable with type 'a t := 'a t
  (** @inline *)

  include Batch with type 'a t := 'a t
  (** @inline *)
end

module type S = sig
  (** An {i indexable} store is a read-write store in which values can be added
      and later found via their keys.

      Keys are not necessarily portable between different stores, so each store
      provides an {!val-index} mechanism to find keys by the hashes of the
      values they reference. *)

  include S_without_key_impl (* @inline *)

  module Key : Key.S with type t = key and type hash = hash
end
```





The encoding and decoding of these values is somewhat complicated.

```
(pack_value_intf.ml)
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
```

FIXME we should comment this file further







### Pack values and the store.pack format

**What is Val?** 

```
(pack_store.ml)
  module Make_without_close_checks
      (Val : Pack_value.Persistent with type hash := K.t and type key := Key.t) =
```





