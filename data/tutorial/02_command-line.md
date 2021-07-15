---
path: "/tutorial/command-line"
title: "Using the command-line"
---

## Installation

These examples requires the `irmin-unix` package to be installed from [opam]:

```shell
$ opam install irmin-unix
```

After that is finished you should have the `irmin` binary installed! To get a
list of commands run:

```shell
$ irmin help
```

## Working with stores

Now you can do things like create an in-memory store and serve it over HTTP:

```shell
$ irmin init --daemon --store mem --address http://127.0.0.1:8888
```

Or create a new store on-disk and manipulate it directly from the terminal:

```shell
$ irmin init
$ export EXAMPLE=/tmp/irmin/example
$ mkdir -p $EXAMPLE
$ irmin set -s git --root $EXAMPLE "My key" "My value"
$ irmin get -s git --root $EXAMPLE "My key"
My value
$ irmin remove -s git --root $EXAMPLE "My key"
```

We can also list the contents of the store in a couple of ways. `irmin tree` is
used to inspect the contents of the store and `irmin list $KEY` is used to list
the contents under a specific path.

```shell
$ irmin set -s git --root $EXAMPLE a/b/c 123
$ irmin set -s git --root $EXAMPLE x 0
$ irmin list -s git --root $EXAMPLE /
DIR a
FILE x
$ irmin list -s git --root $EXAMPLE /a
DIR b
$ irmin list -s git --root $EXAMPLE /a/b
FILE c
$ irmin tree -s git --root $EXAMPLE
/a/b/c...............................................................................123
/x.....................................................................................0
```

## Configuration

If you get sick of passing around `--root` all the time, you can create a
configuration file called `./irmin.yml` or `~/.irmin/config.yml` with global
configuration options:

```yaml
root: /tmp/irmin/example
store: git
contents: string
```

See the output of `irmin help irmin.yml` for a list of configurable parameters.

## Parameters

### Store types (`-s`/`--store`):

- `git`: on-disk Git-compatible store
- `git-mem`: in-memory Git-compatible store
- `mem`: in-memory store
- `fs`: on-disk store

### Content types (`-c`/`--contents`):

- `string`
- `json`: JSON objects
- `json_value`: JSON values

### Customization

It is possible to extend the `irmin` executable using [Irmin_unix.Resolver] and
[Irmin_unix.Cli]:

```ocaml
module Cli = Irmin_unix.Cli
module R = Irmin_unix.Resolver

let () =
  R.Contents.add "my-content-type" (module Irmin.Contents.String);
  R.Store.add "my-store-type" (R.Store.Fixed_hash (fun (module Contents) ->
    R.Store.v (module Irmin_mem.KV.Make(Contents)))
  );
  Cli.(run ~default commands)
```

## Starting a GraphQL server

`irmin` comes with a built-in [GraphQL] server, which can be used to easily
query/modify a store remotely:

```shell
$ irmin graphql --port 8080
```

To verify the GraphQL server is up and running, you can try the following query:

```shell
$ curl http://localhost:8080/graphql -d '{"query": "query { master { head { hash } } }"}'
{"data":{"master":{"head":{"hash":"2a16cd7d8e27d134e6194140617d25d977441396"}}}}
```

You can also visit
[http://localhost:8080/graphql](http://localhost:8080/graphql) for an
interactive environment for writing GraphQL queries. Of course, you're also free
to use your GraphQL client of choice!

## Snapshot/revert

To get a reference to the current state of the database:

```shell
$ irmin snapshot
7941ae769181f4fbf5056d8b2bfe1cd8e10928bd
```

And to restore to that point:

```shell
$ irmin revert 7941ae769181f4fbf5056d8b2bfe1cd8e10928bd
```

## Git compatibility

`irmin` and `git` can be used interchangeably to inspect and modify a
repository. For instance, here are some examples of operations that can be
achieved using either `git` or `irmin`.

### Cloning a remote repository

```shell
$ irmin clone -s git $GIT_REPO_URL
```

```shell
$ git clone $GIT_REPO_URL
```

### Restoring to a previous commit

```shell
$ irmin revert -s git $COMMIT_HASH
```

```shell
$ git reset --hard $COMMIT_HASH
```

### Pushing to a remote repository

```shell
$ irmin push -s git $GIT_REPO_URL
```

```shell
$ git push $GIT_REPO_URL master
```

As you can see, the command-line application has many capabilities, but it's
just a fraction of what's available when using Irmin from OCaml! For more
information about using Irmin and OCaml, check out the next section.

<!-- prettier-ignore-start -->
[Irmin_unix.Resolver]: https://mirage.github.io/irmin/irmin-unix/Irmin_unix/Resolver/index.html
[Irmin_unix.Cli]: https://mirage.github.io/irmin/irmin-unix/Irmin_unix/Cli/index.html
[GraphQL]: https://graphql.org
[opam]: https://github.com/ocaml/opam
<!-- prettier-ignore-end -->
