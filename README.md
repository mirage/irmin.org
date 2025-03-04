# Irmin Website &nbsp;&nbsp; [![OCaml-CI status][ocaml-ci-img]][ocaml-ci]

[ocaml-ci]: https://ocaml.ci.dev/github/mirage/irmin.org
[ocaml-ci-img]: https://img.shields.io/endpoint?url=https%3A%2F%2Focaml.ci.dev%2Fbadge%2Fmirage%2Firmin.org%2Fmain&logo=ocaml

This repository contains the source code for [irmin.org][irmin.org], which describes the [Irmin
distributed database][irmin] and contains tutorials for getting started with Irmin.

## Contributing

All contributions are welcome! The tutorial files can be found in [`data/tutorial`][tutorial-dir].

### Building the Website Locally

The minimum version of Node required to build/run the site is 18. Packages are
managed with [`pnpm`][pnpm]. Since we use Node > 16, `corepack` is the recommended
way to manage `pnpm`. See [`pnpm`'s installation instructions][pnpm-install] for
more information.

The website is generated using [GatsbyJS][gatsby]. The following commands run an instance of the
website locally:

```shell
git clone https://github.com/mirage/irmin.org
cd irmin.org

pnpm install # Install build dependencies
pnpm build   # Build the website
pnpm serve   # Serve the build at `localhost:9000`
```

When working on the website, an incremental development server can be run with `pnpm develop`,
but beware that this may show stale artefacts.

### Running Tests/Linting

- The source code is formatted with [Prettier][prettier]. 
- Any incorrectly formatted code will be reported by `pnpm lint`.
- Use `pnpm format` to apply the changes.

[irmin]: https://github.com/mirage/irmin/
[irmin.org]: https://irmin.org/
[tutorial-dir]: https://github.com/mirage/irmin.org/tree/master/data/tutorial/
[prettier]: https://github.com/prettier/prettier/
[gatsby]: https://www.gatsbyjs.org/
[pnpm]: https://pnpm.io/
[pnpm-install]: https://pnpm.io/installation#using-corepack
