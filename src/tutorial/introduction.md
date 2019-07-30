---
path: "/tutorial/introduction"
title: "Introduction"
---

[Irmin](https://github.com/mirage/irmin) is a key-value store based on the same principles as Git. This means that for existing Git users it provides many familiar features: branching/merging, history and the ability to restore to any previous state.

Typically Irmin is accessed by embedding it into an OCaml application, but can also be accessed using HTTP using `irmin-http` or GraphQL using `irmin-graphql`. It is most often used to store application data, like configuration values, shared state or checkpoint data, but there is nothing stopping you from using it as a general purpose key-value store too. Additionally, since it is compatible with Git, Irmin can be used to interact with Git repositories directly from within your application.

Take a moment to skim the [README](https://github.com/mirage/irmin/blob/master/README.md) to familiarize yourself with some of the concepts. Also, if you find that anything is missing or unclear in this tutorial then please file [an issue](https://github.com/zshipko/irmin-tutorial/issues)!
