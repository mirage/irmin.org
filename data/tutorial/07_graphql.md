---
path: "/tutorial/graphql"
title: "GraphQL Bindings"
---

`irmin-graphql` provides a nice interface for accessing remote Irmin stores over
a network. This section will show you how to run an `irmin-graphql` server and
query it using your favorite GraphQL client!

## Installation

`irmin-graphql` is part of the latest Irmin release, so all that's needed is:

```shell
$ opam install irmin-cli
```

## Running the Server

To start the GraphQL server:

```shell
$ irmin graphql --port 8080 &
```

This will start the server on `localhost:8080`, which can be customised using
the `--address` and `--port` flags. By default `irmin-graphql` provides an
GraphiQL editor for writing queries from within the browser. It can be
accessed at [http://localhost:8080/graphql](http://localhost:8080/graphql).

## Schema

Through the GraphiQL web interface you can explore the schema using the **Docs**
button in the upper-right corner. Additionally, there are tools like
[`get-graphql-schema`], which will dump the entire schema for you.

## Queries

By using `irmin-graphql`, it is possible to collect information about Irmin
databases (and Git repositories) using GraphQL.

### Get

To begin, let's create a query to retrieve the value stored at the path
`abc`:

```graphql
query {
  main {
    tree {
      get(path: "abc")
    }
  }
}
```

The following would accomplish the same thing in `my-branch`:

```graphql
query {
  branch(name: "my-branch") {
    tree {
      get(path: "a/b/c")
    }
  }
}
```

It's also possible to set or update multiple paths using the `set_tree` and
`update_tree` mutations. The following will set `/a` to "foo" and `/b` to "bar":

```graphql
mutation {
  set_tree(
    path: "/"
    tree: [{ path: "a", value: "foo" }, { path: "b", value: "bar" }]
  ) {
    hash
  }
}
```

Updating multiple paths is similar:

```graphql
mutation {
  update_tree(
    path: "/"
    tree: [{ path: "a", value: "testing" }, { path: "b", value: null }]
  ) {
    hash
  }
}
```

This will set `a` to "testing" and remove the value associated with `b`.

### Branch Info

By using `main`/`branch` queries, we can find lots of information about the
attached Irmin store:

```graphql
query {
  main {
    head {
      hash
      info
      parents
    }
  }
}
```

### Bulk Queries

Due to difficulties representing infinitely recursive datatypes in GraphQL, an
Irmin tree is represented using the `[TreeItem!]` type. `TreeItem` has the
following keys:

- `path`
- `value`
- `metadata`

Using this new information, it is possible to list every key/value pair using:

```graphql
query {
  main {
    head {
      tree {
        list_contents_recursively {
          path
          value
        }
      }
    }
  }
}
```

This can also be augmented by using `get_tree` to return a specific subtree:

```graphql
query {
  main {
    head {
      tree {
        get_tree(path: "a") {
          list_contents_recursively {
            path
            value
          }
        }
      }
    }
  }
}
```

## Mutations

`irmin-graphql` also supports mutations, which are basically queries with
side-effects.

### Set

For example, setting a path is easy:

```graphql
mutation {
  set(path: "a/b/c", value: "123") {
    hash
  }
}
```

The example above sets the key "a/b/c" (`["a"; "b"; "c"]` in OCaml) to "123" and
returns the new commit's hash.

### Sync

`clone`, `push`, and `pull` are also supported, as long as they're supported by
the underlying store! This allows data to be synchronised across servers using a
simple mutation:

```graphql
mutation {
  pull(remote: "git://github.com/mirage/irmin") {
    hash
  }
}
```

### Bulk Updates

To update multiple values, use `set_tree` and `update_tree`. The
difference between them is that `set_tree` will modify the tree to match the
provided tree, while `update_tree` will only modify the provided keys, which will only update
the value if one is provided. Otherwise it removes the current value if `null` is
provided. For example:

```graphql
mutation {
  set_tree(
    path: "/"
    tree: [{ path: "a/b/c", value: "123" }, { path: "d/e/f", value: "456" }]
  ) {
    hash
  }
}
```

This will set `a/b/c` to `"123"` and `d/e/f` to "456", and if there are any other
keys, they will be removed. To keep the existing values, `update_tree` should be
used:

```graphql
mutation {
  update_tree(
    path: "/"
    tree: [
      { path: "a/b/c", value: "123" }
      { path: "d/e/f", value: "456" }
      { path: "testing", value: null }
    ]
  ) {
    hash
  }
}
```

The above query will set the values of `a/b/c` and `d/e/f` while removing the
value associated with `testing`. All other values will be left as-is.

## GraphQL Servers in OCaml

It is also possible to use the `irmin-graphql` OCaml interface to embed a
GraphQL server in any application!

By using `Irmin_graphql_unix.Server.Make`, you can convert an existing `Irmin.S`
typed module into a GraphQL server:

```ocaml
module Graphql_store = Irmin_git_unix.Mem.KV(Irmin.Contents.String)
module Graphql = Irmin_graphql_unix.Server.Make(Graphql_store)(struct let remote = Some Graphql_store.remote end)
```

The following code will initialise and run the server:

```ocaml
let run_server () =
  (* Set up the Irmin store *)
  let* repo = Graphql_store.Repo.v (Irmin_git.config "/tmp/irmin") in

  (* Initialize the GraphQL server *)
  let server = Graphql.v repo in

  (* Run the server *)
  let on_exn exn =
    Logs.debug (fun l -> l "on_exn: %s" (Printexc.to_string exn))
  in
  Cohttp_lwt_unix.Server.create ~on_exn ~mode:(`TCP (`Port 1234)) server
```

### Customisation

It is possible to use a custom JSON representation for a `type` by implementing
your own `Schema.typ` value:

```ocaml
module Example_type = struct
  type t = {x: string; y: string; z: string}

  let t =
    let open Irmin.Type in
    record "Example_type" (fun x y z -> {x; y; z})
    |+ field "x" string (fun t -> t.x)
    |+ field "y" string (fun t -> t.y)
    |+ field "z" string (fun t -> t.z)
    |> sealr

  let merge = Irmin.Merge.(option (default t))
end

let schema_typ : (unit, Example_type.t option) Irmin_graphql.Server.Schema.typ =
  let open Example_type in
  Irmin_graphql.Server.Schema.(obj "Example"
    ~fields:[
      field "x"
        ~typ:(non_null string)
        ~args:[]
        ~resolve:(fun _ t -> t.x)
      ;
      field "y"
        ~typ:(non_null string)
        ~args:[]
        ~resolve:(fun _ t -> t.y)
      ;
      field "z"
        ~typ:(non_null string)
        ~args:[]
        ~resolve:(fun _ t -> t.z)
      ;
    ]
  )
```

(You may also opt to use `Irmin_graphql.Server.Default_types`, which can be used
on any `Irmin.S`)

Once you've done this for one or both of `schema_typ` and `arg_type`, you must
wrap them in `Irmin_graphql.Server.CUSTOM_TYPES` before passing them to
`Irmin_graphql.Server.Make_ext`:

```ocaml
module Store = Irmin_mem.KV.Make (Example_type)

module Custom_types = struct
  module Defaults = Irmin_graphql.Server.Default_types (Store)

  (* Use the default types for most things *)
  module Path = Defaults.Path
  module Metadata = Defaults.Metadata
  module Hash = Defaults.Hash
  module Branch = Defaults.Branch
  module Contents_key = Defaults.Contents_key
  module Node_key = Defaults.Node_key
  module Commit_key = Defaults.Commit_key

  module Contents = struct
    include Defaults.Contents
    let schema_type = schema_typ
  end
end

module Config = struct
  module Info = Irmin_unix.Info(Store.Info)

  let remote = None

  type info = Info.t
  let info = Info.v
end

module Graphql_ext =
  Irmin_graphql.Server.Make_ext
    (Cohttp_lwt_unix.Server)
    (Config)
    (Store)
    (Custom_types)
```

<!-- prettier-ignore-start -->
[get-graphql-schema]: https://github.com/prisma/get-graphql-schema
<!-- prettier-ignore-end -->
