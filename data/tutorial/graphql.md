---
path: "/tutorial/graphql"
title: "GraphQL bindings"
---

`irmin-graphql` provides a nice interface for accessing remote Irmin stores over a network. This section will show you how to run an `irmin-graphql` server and query it using [irmin-js](https://github.com/zshipko/irmin-js), or your favorite GraphQL client!

## Installation

`irmin-graphql` is part of the latest `irmin` release, so all that's needed is:

```shell
$ opam install irmin-unix
```

## Running the server

To start the GraphQL server:

```shell
$ irmin graphql --port 8080
```

This will start the server on `localhost:8080` - this can be customized using the `--address` and `--port` flags. By default `irmin-graphql` provides an GraphiQL editor for writing queries from within the browser which can be accessed at [http://localhost:8080/graphql](http://localhost:8080/graphql).

## Available clients

There are several reference client implementations which provide many basic queries by default, in addition to simplifying the process of executing handwritten queries.

- [irmin-js](https://github.com/zshipko/irmin-js)
- [irmin-go](https://github.com/zshipko/irmin-go)

## Schema

Using the GraphiQL web interface you can explore the schema using the **Docs** button in the upper-right corner. Additionally, there are tools like [`get-graphql-schema`](https://github.com/prisma/get-graphql-schema) which will dump the entire schema for you.

## Queries

Using `irmin-graphql` it is possible to collect information about Irmin databases (and Git repositories) using GraphQL.

### Get

To start off we will create a query to retrieve the value stored at the path `abc`:

```graphql
query {
    master {
      tree {
        get(key: "abc")
      }
    }
}
```

Using `irmin-js` the same query would be written as:

```javascript
let ir = new Irmin("http://localhost:8080/graphql");
ir.master().get("abc").then((res) => {
    ...
});
```

**NOTE**: `irmin-js` can also be used to send execute raw queries:

```javascript
let ir = new Irmin("http://localhost:8080/graphql");
ir.execute({
    body: "query { master { tree { get(key: "abc") } } }",
    variables: {}
}).then((res) => {
    ...
});
```

The following would accomplish the same thing in `my-branch`:

```graphql
query {
    branch(name: "my-branch") {
      tree {
    	  get(key: "a/b/c")
      }
    }
}
```

It's also possible to set or update multiple keys using the `set_tree` and `update_tree` mutations. The following will set `/a` to "foo" and `/b` to "bar":

```graphql
mutation {
  set_tree(key: "/", tree: [{key: "a", value: "foo"}, {key: "b", value:"bar"}]){
    hash
  }
}
```

And updating multiple keys is similar:

```graphql
mutation {
  update_tree(key: "/", tree: [{key: "a", value: "testing"}, {key: "b", value: null}]){
    hash
  }
}
```

this will set `a` to "testing" and remove the value associated with `b`.


### Branch info

Using `master`/`branch` queries we are able to find lots of information about the attached Irmin store:

```graphql
query {
    master {
        head {
            hash
            info
            parents
        }
    }
}
```

### Bulk queries

Due to difficulties representing infinitely recursive datatypes in GraphQL, an Irmin tree is represented using the `[TreeItem!]` type. `TreeItem` has the following keys:

- `key`
- `value`
- `metadata`

Using this new information, it is possible to list every key/value pair using:

```graphql
query {
	master {
    head {
      tree {
        list_contents_recursively {
          key,
          value
        }
      }
    }
  }
}
```

Which can also be augmented using `get_tree` to return a specific subtree:

```graphql
query {
	master {
    head {
      tree {
        get_tree(key:"a"){
        	list_contents_recursively {
          	key,
          	value
        	}
      	}
      }
    }
  }
}
```

## Mutations

`irmin-graphql` also supports mutations, which are basically queries with side-effects.

### Set

For example, setting a key is easy:

```graphql
mutation {
    set(key: "a/b/c", value: "123") {
        hash
    }
}
```

The example above sets the key "a/b/c" (`["a"; "b"; "c"]` in OCaml) to "123" and returns the new commit's hash.

### Sync

`clone`, `push` and `pull` are also supported as long as they're supported by the underlying store! This allows data to be synchronized across servers using a simple mutation:

```graphql
mutation {
    pull(remote: "git://github.com/mirage/irmin") {
        hash
    }
}
```

### Bulk updates

To update multiple values you can use `set_tree` and `update_tree`. The difference between the two is `set_tree` will modify
the tree to match to provided tree, while `update_tree` will only modify the provided keys - updating the value if one is
provided, otherwise removing the current value if `null` is provided. For example:

```graphql
mutation {
  set_tree (key: "/", tree: [
    {key:"a/b/c", value:"123"},
    {key:"d/e/f", value:"456"}
  ]) {
    hash
  }
}
```

will set `a/b/c` to `"123"` and `d/e/f` to "456", and if there are any other keys they will be removed. To keep the existing values,
`update_tree` should be used:


```graphql
mutation {
  update_tree (key: "/", tree: [
    {key:"a/b/c", value:"123"},
    {key:"d/e/f", value:"456"},
    {key:"testing", value:null}
  ]) {
    hash
  }
}
```

The above query will set the values of `a/b/c` and `d/e/f`, while removing the value associated with `testing` - all other values
will be left as-is.


## GraphQL servers in OCaml

It is also possible to use the `irmin-graphql` OCaml interface to embed a GraphQL server in any application!

Using `Irmin_unix.Graphql.Server.Make` you can convert an existing `Irmin.S` typed module into a GraphQL server:

```ocaml
module Graphql_store = Irmin_unix.Git.Mem.KV(Irmin.Contents.String)
module Graphql = Irmin_unix.Graphql.Server.Make(Graphql_store)(struct let remote = Some Graphql_store.remote end)
```

The following code will initialize and run the server:

```ocaml
let run_server () =
  (* Set up the Irmin store *)
  Graphql_store.Repo.v (Irmin_git.config "/tmp/irmin") >>= fun repo ->

  (* Initialize the GraphQL server *)
  let server = Graphql.v repo in

  (* Run the server *)
  let on_exn exn =
    Logs.debug (fun l -> l "on_exn: %s" (Printexc.to_string exn))
  in
  Cohttp_lwt_unix.Server.create ~on_exn ~mode:(`TCP (`Port 1234)) server
```

### Customization

It is possible to use a custom JSON representation for `contents` and `metadata`
values by implementing `Irmin_graphql.Server.PRESENTER`:

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

module Example_presenter = struct
  type t = Example_type.t
  type src = Example_type.t
  let to_src _tree _key t = t
  let schema_typ =
    let open Example_type in
    Irmin_graphql.Server.Schema.(obj "Example"
      ~fields:(fun _ -> [
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
      ])
    )
end
```

(You may also opt to use `Irmin_graphql.Server.Default_presentation`, which can be used on any `Irmin.Type.S`)

Once you've done this for both the `contents` and `metadata` types you need to wrap them in `Irmin_graphql.Server.PRESENTATION` before passing them to `Irmin_graphql.Server.Make_ext`:

```ocaml
module Example_store = Irmin_mem.KV(Example_type)

module Presentation = struct
  module Default = Irmin_graphql.Server.Default_presentation(Example_store)
  module Metadata = Default.Metadata
  module Contents = Example_presenter
end

module Config = struct
  let remote = None
  let info = Irmin_unix.info
end

module Graphql_ext =
  Irmin_graphql.Server.Make_ext
    (Cohttp_lwt_unix.Server)
    (Config)
    (Example_store)
    (Presentation)
```
