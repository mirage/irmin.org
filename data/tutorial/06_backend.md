---
path: "/tutorial/backend"
title: "Writing a storage backend"
---

This section illustrates how to write a custom storage backend for Irmin using a
simplified implementation of [irmin-redis] as an example. `irmin-redis` uses a
Redis server to store Irmin data.

Unlike writing a [custom datatype](/tutorial/contents), there is no tidy way of
doing this. A backend is built from a number of
[lower level stores](/tutorial/architecture) (commits, nodes, contents or
branches), where each store implements some of the operations needed by the
backend. In this example we instantiate two functors: one of type
[Irmin.Content_addressable.Maker] (for the block store) and
[Irmin.Atomic_write.Maker] (for the reference store). The two are used in
creating a module of type [Irmin.Maker], which is in turn used in a functor of
type [Irmin.KV_maker].

## Redis client

This example uses the [hiredis] package to create connections, send and receive
data from Redis servers. It is available on [opam] under the same name.

## The readonly store

The process for writing a backend for Irmin requires implementing a few functors
-- to accomplish this, we can start off by writing a helper module that provides
a generic implementation that can be re-used by the content-addressable store
and the atomic-write store:

- `t`: the store type
- `key`: the key type
- `value`: the value/content type

```ocaml
open Lwt.Infix
open Hiredis
```

```ocaml
let ignore_prefix ~prefix s =
  let len = String.length prefix in
  String.sub s len (String.length s - len)

module Helper (K: Irmin.Type.S) (V: Irmin.Type.S) = struct
  type 'a t = (string * Client.t) (* Store type: Redis prefix and client *)
  type key = K.t                  (* Key type *)
  type value = V.t                (* Value type *)
```

Additionally, it requires a few functions:

- `v`: used to create a value of type `t`
- `mem`: checks whether or not a key exists
- `find`: returns the value associated with a key (if it exists)

A single Redis instance provides all of the different types of stores within an
Irmin database. This entails two issues that we have to address in our
implementation. First, some functions (namely `list`) need to differentiate
between entries of the atomic-write store and ones of other stores. We use two
prefixes ,`"obj"` and `"data"`, added at the beginning of a key, to identify the
store type in Redis.

The second issue is that the requests to the server from one store can
interleave with the requests of another store (as for example in the `batch`
function). Therefore, to prevent conflicts, each store has its own Redis client.

```ocaml
  let v prefix config =
    let module C = Irmin.Private.Conf in
    let root = match C.get config C.root with
      | Some root -> root ^ ":" ^ prefix ^ ":"
      | None -> prefix ^ ":"
    in
    let client = Client.connect ~port:6379 "127.0.0.1" in
    let () =
      match Hiredis.Client.run client [|"PING"|] with
      | Nil ->
          print_endline "redis-server is not running"
      | Status pong ->
          assert (String.equal pong "PONG")
      | s ->
          failwith ("unexpected server response" ^ encode_string s)
    in
    Lwt.return (root, client)
```

`mem` is implemented using the `EXISTS` command, which checks for the existence
of a key in Redis:

```ocaml
  let mem (prefix, client) key =
      let key = Irmin.Type.to_string K.t key in
      match Client.run client [| "EXISTS"; prefix ^ key |] with
      | Integer 1L -> Lwt.return_true
      | _ -> Lwt.return_false
```

`find` uses the `GET` command to retrieve the key, if one isn't found or can't
be decoded correctly then `find` returns `None`:

```ocaml
  let find (prefix, client) key =
      let key = Irmin.Type.to_string K.t key in
      match Client.run client [| "GET"; prefix ^ key |] with
      | String s ->
          (match Irmin.Type.of_string V.t s with
          | Ok s -> Lwt.return_some s
          | _ -> Lwt.return_none)
      | _ -> Lwt.return_none
```

`clear` is used to cleanup any data in the store:

```ocaml
  let clear (prefix, client) =
    match Client.run client [| "KEYS"; prefix ^ "*" |] with
      | Array arr ->
          Lwt.wrap (fun () ->
            Array.iter (fun s ->
                let s = Value.to_string s |> ignore_prefix ~prefix in
                ignore (Client.run client [| "DEL"; s |])) arr)
      | _ -> Lwt.return_unit
end
```

### The content-addressable store

Next is the content-addressable [Irmin.CONTENT_ADDRESSABLE_STORE] interface -
the majority of the required methods can be inherited from `Helper`!

```ocaml
module Content_addressable : Irmin.Content_addressable.Maker = functor
    (K: Irmin.Hash.S)
    (V: Irmin.Type.S) -> struct

  include Helper(K)(V)
  let v = v "obj"
```

This module needs an `add` function, which takes a value, hashes it, stores the
association and returns the hash:

```ocaml
  let encode_value = Irmin.Type.(unstage (to_bin_string V.t))
  let add (prefix, client) value =
      let hash = K.hash (fun f -> f (encode_value value)) in
      let key = Irmin.Type.to_string K.t hash in
      let value = Irmin.Type.to_string V.t value in
      ignore (Client.run client [| "SET"; prefix ^ key; value |]);
      Lwt.return hash

  let unsafe_add t _ v = add t v >|= ignore
```

Then a `batch` function, which can be used to group writes together. We will use
the most basic implementation:

```ocaml
  let batch (prefix, client) f =
    let _ = Client.run client [| "MULTI" |] in
    f (prefix, client) >|= fun result ->
    let _ = Client.run client [| "EXEC" |] in
    result

```

Finally, we must provide a `close` function to free any resources held by the
backend. In our case, this can be a simple no-op:

```ocaml
  let close _t = Lwt.return_unit
end
```

## The atomic-write store

The [Irmin.ATOMIC_WRITE_STORE] has many more types and values that need to be
defined than the previous examples, but luckily this is the last step!

To start off we can use the `Helper` functor defined above:

```ocaml
module Atomic_write: Irmin.Atomic_write.Maker = functor
    (K: Irmin.Type.S)
    (V: Irmin.Type.S) -> struct

  module H = Helper(K)(V)
```

There are a few types we need to declare next. `key` and `value` should match
`H.key` and `H.value` and `watch` is used to declare the type of the watcher --
this is used to send notifications when the store has been updated.
[irmin-watcher] has some more information on watchers.

```ocaml
  module W = Irmin.Private.Watch.Make(K)(V)
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
    H.v "data" config >>= fun t ->
    Lwt.return {t; w = watches }
```

The next few functions (`find` and `mem`) are just wrappers around the
implementations in `H`:

```ocaml
  let find t = H.find t.t
  let mem t  = H.mem t.t
```

A few more simple functions: `watch_key`, `watch` and `unwatch`, used to created
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
- `test_and_set`, modifies a key only if the `test` value matches the current
  value for the given key.
- `close`, closes any resources held by the backend.

The `list` implementation will get a list of keys from Redis using the `KEYS`
command then convert them from strings to `Store.key` values:

```ocaml
  let list {t = (prefix, client); _} =
      match Client.run client [| "KEYS"; prefix ^ "*" |] with
      | Array arr ->
          Array.map (fun k ->
            let k = Value.to_string k |> ignore_prefix ~prefix in
            Irmin.Type.of_string K.t k
          ) arr
          |> Array.to_list
          |> Lwt_list.filter_map_s (function
            | Ok s -> Lwt.return_some s
            | _ -> Lwt.return_none)
      | _ -> Lwt.return []
```

`set` just encodes the keys and values as strings, then uses the Redis `SET`
command to store them. As this operation updates the store, the watchers have to
be notified:

```ocaml
  let set {t = (prefix, client); w} key value =
      let key' = Irmin.Type.to_string K.t key in
      let value' = Irmin.Type.to_string V.t value in
      match Client.run client [| "SET"; prefix ^ key'; value' |] with
      | Status "OK" -> W.notify w key (Some value)
      | _ -> Lwt.return_unit
```

`remove` uses the Redis `DEL` command to remove stored values and then notifies
the watchers:

```ocaml
  let remove {t = (prefix, client); w} key =
      let key' = Irmin.Type.to_string K.t key in
      ignore (Client.run client [| "DEL"; prefix ^ key' |]);
      W.notify w key None
```

`test_and_set` will modify a key if the current value is equal to `test`. This
requires an atomic check and set, which can be done using `WATCH`, `MULTI` and
`EXEC` in Redis:

```ocaml
  let value_equal = Irmin.Type.(unstage (equal (option V.t)))

  let test_and_set t key ~test ~set:set_value =
    (* A helper function to execute a command in a Redis transaction *)
    let txn client args =
      ignore @@ Client.run client [| "MULTI" |];
      ignore @@ Client.run client args;
      Client.run client [| "EXEC" |] <> Nil
    in
    let prefix, client = t.t in
    let key' = Irmin.Type.to_string K.t key in
    (* Start watching the key in question *)
    ignore @@ Client.run client [| "WATCH"; prefix ^ key' |];
    (* Get the existing value *)
    find t key >>= fun v ->
    (* Check it against [test] *)
    if value_equal test v then (
      (match set_value with
        | None -> (* Remove the key *)
            if txn client [| "DEL"; prefix ^ key' |] then
              W.notify t.w key None >>= fun () ->
              Lwt.return_true
            else
              Lwt.return_false
        | Some value -> (* Update the key *)
            let value' = Irmin.Type.to_string V.t value in
            if txn client [| "SET"; prefix ^ key'; value' |] then
              W.notify t.w key set_value >>= fun () ->
              Lwt.return_true
            else
              Lwt.return_false
      ) >>= fun ok ->
      Lwt.return ok
    ) else (
      ignore @@ Client.run client [| "UNWATCH"; prefix ^ key' |];
      Lwt.return_false
    )
```

Finally, we need to pull in `clear` from our `Helper` implementation and add
another `close` function:

```ocaml
  let clear {t; _} = H.clear t

  let close _t = Lwt.return_unit
end
```

Now, let's use the `Make` and `KV` functors for creating Redis-backed Irmin
stores:

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

We also have to provide a configuration for our backend specifying the
parameters needed when initialising a store. In our example, we start with an
empty configuration, which comes with `root` as a parameter. We can then
instantiate the store and create a repo:

```ocaml skip
let config ?(config = Irmin.Private.Conf.empty) ?root () =
  let module C = Irmin.Private.Conf in
  C.add config C.root root

module Store = KV (Irmin.Contents.String)
let _repo = Store.Repo.v (config ())
```

## The Redis Server

To test this example we also need a Redis server running. We can start one from
the command line using the default configuration, which runs the server on port
6379:

```shell
$ redis-server /usr/local/etc/redis.conf
```

or we can run the server from OCaml:

```ocaml skip
let start_server () =
  let config = [("port", ["6379"]); ("daemonize", ["no"])] in
  let server = Hiredis.Shell.Server.start ~config 6379 in
  let () = print_endline "Starting redis server" in
  let () = Unix.sleep 1 in
  server

let stop_server server () = Hiredis.Shell.Server.stop server
```

<!-- prettier-ignore-start -->
[Irmin.S_MAKER]: https://mirage.github.io/irmin/irmin/Irmin/module-type-S_MAKER/index.html
[Irmin.KV_MAKER]: https://mirage.github.io/irmin/irmin/Irmin/module-type-KV_MAKER/index.html
[Irmin.CONTENT_ADDRESSABLE_STORE_MAKER]: https://mirage.github.io/irmin/irmin/Irmin/module-type-CONTENT_ADDRESSABLE_STORE_MAKER/index.html
[Irmin.CONTENT_ADDRESSABLE_STORE]: https://mirage.github.io/irmin/irmin/Irmin/module-type-CONTENT_ADDRESSABLE_STORE/index.html
[Irmin.ATOMIC_WRITE_STORE]: https://mirage.github.io/irmin/irmin/Irmin/module-type-ATOMIC_WRITE_STORE/index.html
[Irmin.ATOMIC_WRITE_STORE_MAKER]: https://mirage.github.io/irmin/irmin/Irmin/module-type-ATOMIC_WRITE_STORE_MAKER/index.html

[irmin-watcher]: https://github.com/mirage/irmin-watcher
[irmin-redis]: https://github.com/zshipko/irmin-redis
[hiredis]: https://github.com/zshipko/ocaml-hiredis
[opam]: https://github.com/ocaml/opam
<!-- prettier-ignore-end -->
