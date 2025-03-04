---
path: "/tutorial/introduction"
title: "Introduction"
---

[Irmin] is a key-value store based on the same principles as Git. This means
that for existing Git users it provides many familiar features:
branching/merging, history, and the ability to restore to any previous state.

Typically Irmin is used by embedding it into an OCaml application, but it can also
be accessed through HTTP, using `irmin-http`, or GraphQL, using `irmin-graphql`. It
is most often used to store application data, like configuration values, shared
state, or checkpoint data; but there is nothing stopping you from using it as a
general-purpose key-value store too. Additionally, since it is compatible with
Git, Irmin can be used to interact with Git repositories directly from within
your application.

Take a moment to skim the [README][irmin-readme] to familiarise yourself with
some of the concepts. This tutorial should always be up to date with the latest
opam release. If you find that anything is outdated, missing, or unclear,
please file [an issue][irmin-issues]!

<!-- prettier-ignore-start -->
[irmin]: https://github.com/mirage/irmin
[irmin-issues]: https://github.com/mirage/irmin.org/issues
[irmin-readme]: https://github.com/mirage/irmin/blob/main/README.md
<!-- prettier-ignore-end -->
