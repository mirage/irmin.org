---
path: "/tutorial/backend"
title: "Writing a Storage Backend"
---

This section illustrates how to write a custom storage backend for Irmin using
an in-memory store as an example.

Unlike writing a [custom datatype](/tutorial/contents), there is no tidy way of
doing writing a custom storage backend. A backend is built from a number of
[lower level stores](/tutorial/architecture) (commits, nodes, contents, or
branches), where each store implements some of the operations needed by the
backend. In this example, we instantiate two functors: one of type
[`Irmin.Content_addressable.Maker`] (for the block store) and
[`Irmin.Atomic_write.Maker`] (for the reference store). The two are used in
creating a module of type [`Irmin.Maker`], which is in turn used in a functor of
type [`Irmin.KV_maker`].

## The Read-Only Store

The process for writing an Irmin backend requires implementing a few functors. 
To accomplish this, let's start by writing a helper module to provide
a generic implementation that can be reused by the content-addressable store
and the atomic-write store:

- `t`: the store type
- `key`: the key type
- `value`: the value/content type

```ocaml
open Lwt.Syntax

module Helper (K: Irmin.Type.S) (V: Irmin.Type.S) = struct
  module Tbl = Hashtbl.Make(struct
    type t = K.t
    let equal a b = Irmin.Type.(unstage (equal K.t)) a b
    let hash k = Irmin.Type.(unstage (short_hash K.t)) k
  end)
  type 'a t = V.t Tbl.t (* Store type: a hashtable mapping keys to values *)
  type key = K.t                   (* Key type *)
  type value = V.t                 (* Value type *)
```

Additionally, it requires a few functions:

- `v`: used to create a value of type `t`
- `mem`: checks whether or not a key exists
- `find`: returns the value associated with a key (if it exists)

When creating a new backend, utilise the functions in
`Irmin.Backend.Conf` to work with `Irmin.config` values. Additionally, each
backend should register a new config specification using
`Irmin.Backend.Conf.Spec`:

```ocaml
  let spec = Irmin.Backend.Conf.Spec.v "tutorial"

  let init_size = Irmin.Backend.Conf.key ~spec "init-size" Irmin.Type.int 8

  let v config =
    let module C = Irmin.Backend.Conf in
    let init_size = C.get config init_size in
    Lwt.return (Tbl.create init_size)
```

`mem` can be implemented directly using `Tbl.mem`:

```ocaml
  let mem t key =
      Lwt.return (Tbl.mem t key)
```

`find` uses `Tbl.find_opt`:

```ocaml
  let find t key =
      Lwt.return (Tbl.find_opt t key)
```

`clear` is used to cleanup any data in the store:

```ocaml
  let clear t =
    Tbl.clear t;
    Lwt.return_unit
end
```

### The Content-Addressable Store

Next is the content-addressable [`Irmin.Content_addressable.S`] interface. The
majority of the required methods can be inherited from `Helper`!

```ocaml
module Content_addressable : Irmin.Content_addressable.Maker = functor
    (K: Irmin.Hash.S)
    (V: Irmin.Type.S) -> struct

  include Helper(K)(V)
```

This module needs an `add` function, which takes a value, hashes it, stores the
association, and returns the hash:

```ocaml
  let encode_value = Irmin.Type.(unstage (to_bin_string V.t))

  let unsafe_add t k v =
      Tbl.replace t k v;
      Lwt.return_unit

  let add t value =
      let hash = K.hash (fun f -> f (encode_value value)) in
      let+ () = unsafe_add t hash value in
      hash
```

Let's add a `batch` function, which can be used to group writes together. We will use
the most basic implementation with a global lock:

```ocaml
  let lock = Mutex.create ()

  let batch t f =
    Mutex.lock lock;
    let+ x = Lwt.catch (fun () -> f t)
      (fun exn ->
        Mutex.unlock lock;
        raise exn)
    in
    Mutex.unlock lock;
    x
```

Finally, we must provide a `close` function to free any resources held by the
backend. In our case, this can be a simple no-op:

```ocaml
  let close _t = Lwt.return_unit
end
```

## The Atomic-Write Store

[`Irmin.Atomic_write.S`] has many more types and values that need to be defined
than the previous examples, but luckily this is the last step!

To begin, we can use the `Helper` functor defined above:

```ocaml
module Atomic_write: Irmin.Atomic_write.Maker = functor
    (K: Irmin.Type.S)
    (V: Irmin.Type.S) -> struct

  module H = Helper(K)(V)
```

Next, we need to declare a few types. `key` and `value` should match
`H.key` and `H.value`. `watch` declares the type of the watcher.
This is used to send notifications when the store has been updated.
[`irmin-watcher`] has some more information on watchers.

```ocaml
  module W = Irmin.Backend.Watch.Make(K)(V)
  type t = { t: [`Write] H.t; w: W.t }  (* Store type *)
  type key = H.key                      (* Key type *)
  type value = H.value                  (* Value type *)
  type watch = W.watch                  (* Watch type *)
```

The `watches` variable defined below creates a context used to track active
watches.

```ocaml
  let watches = W.v ()
```

Again, we need a `v` function for creating a value of type `t`:

```ocaml
  let v config =
    let* t = H.v config in
    Lwt.return {t; w = watches }
```

The next few functions (`find` and `mem`) are just wrappers around the
implementations in `H`:

```ocaml
  let find t = H.find t.t
  let mem t  = H.mem t.t
```

The simple functions `watch_key`, `watch`, and `unwatch` are used to create
or destroy watches:

```ocaml
  let watch_key t key = W.watch_key t.w key
  let watch t = W.watch t.w
  let unwatch t = W.unwatch t.w
```

We will need to implement a few more functions:

- `list`, lists files at a specific path.
- `set`, writes a value to the store.
- `remove`, deletes a value from the store.
- `test_and_set`, modifies a key, only if the `test` value matches the current
  value for the given key.
- `close`, closes any resources held by the backend.

The `list` implementation gets a list of keys in the store:

```ocaml
  let list {t; _} =
      let keys = H.Tbl.to_seq_keys t |> List.of_seq in
      Lwt.return keys
```

`set` stores a key/value pair in the store. When this operation updates the
store, the watchers have to be notified:

```ocaml
  let set {t; w} key value =
      let exists = H.Tbl.mem t key in
      H.Tbl.replace t key value;
      if exists then W.notify w key (Some value)
      else Lwt.return_unit
```

`remove` deletes stored values and then notifies the watchers:

```ocaml
  let remove {t; w} key =
      H.Tbl.remove t key;
      W.notify w key None
```

`test_and_set` will modify a key, if the current value is equal to `test`. This
requires an atomic check and set:

```ocaml
  let value_equal = Irmin.Type.(unstage (equal (option V.t)))

  let test_and_set {t; w} key ~test ~set:set_value =
    let v = H.Tbl.find_opt t key in
    if value_equal v test then (
        let () =
          match set_value with
          | Some set_value ->
            H.Tbl.replace t key set_value
          | None ->
            H.Tbl.remove t key
        in
        let* () = W.notify w key set_value in
        Lwt.return_true
    ) else Lwt.return_false
```

Finally, we must pull in `clear` from our `Helper` implementation and add
another `close` function:

```ocaml
  let clear {t; _} =
      H.Tbl.clear t;
      Lwt.return_unit

  let close _t = Lwt.return_unit
end
```

Now, let's use the `Make` and `KV` functors for creating in-memory Irmin stores:

```ocaml
module Maker: Irmin.Maker = Irmin.Maker (Content_addressable) (Atomic_write)

module KV = struct
  type endpoint = unit
  type metadata = unit

  module Make(C: Irmin.Contents.S) = struct
    include Maker.Make
      (struct
        module Info = Irmin.Info.Default
        module Metadata = Irmin.Metadata.None
        module Contents = C
        module Path = Irmin.Path.String_list
        module Branch = Irmin.Branch.String
        module Hash = Irmin.Hash.SHA1
        module Node = Irmin.Node.Make(Hash)(Path)(Metadata)
        module Commit = Irmin.Commit.Make(Hash)
      end)
  end
end
```

We also have to provide a configuration for our backend, specifying the
parameters needed when initialising a store. In our example, we start with an
empty configuration, which comes with `root` as a parameter. We can then
instantiate the store and create a repo:

```ocaml skip
let config ?(config = Irmin.Backend.Conf.empty) ?root () =
  let module C = Irmin.Backend.Conf in
  C.add config C.root root

module Store = KV (Irmin.Contents.String)
let _repo = Store.Repo.v (config ())
```

<!-- prettier-ignore-start -->
[Irmin.Maker.S]: https://mirage.github.io/irmin/irmin/Irmin/module-type-S_MAKER/index.html
[Irmin.KV_maker]: https://mirage.github.io/irmin/irmin/Irmin/module-type-KV_MAKER/index.html
[Irmin.Content_addressable.S]: https://mirage.github.io/irmin/irmin/Irmin/Content_addressable/module-type-S/index.html
[Irmin.Atomic_write.S]: https://mirage.github.io/irmin/irmin/Irmin/Atomic_write/module-type-S/index.html

[irmin-watcher]: https://github.com/mirage/irmin-watcher
<!-- prettier-ignore-end -->
