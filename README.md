# Irmin website &nbsp;&nbsp; [![Travis status][travis-img]][travis]

[travis]: https://travis-ci.org/mirage/irmin.io/branches
[travis-img]: https://travis-ci.org/mirage/irmin.io.svg?branch=master

This repository contains the source code for [irmin.io][irmin.io], which describes the [Irmin
distributed database][irmin] and contains tutorials for getting started with Irmin.

## Contributing

All contributions are welcome! The tutorial files can be found in [`data/tutorial`][tutorial-dir].

### Building the website locally

The website is generated using [GatsbyJS][gatsby]. The following commands run an instance of the
website locally:

```shell
git clone https://github.com/mirage/irmin.io
cd irmin.io

yarn install    # Install build dependencies
yarn run build  # Build the website
yarn run serve  # Serve the build at `localhost:9000`
```

When working on the website, an incremental development server can be run with `yarn run develop`,
but beware that this may show stale artefacts.

### Running tests/linting

- The source code is formatted with [Prettier][prettier], and this is enforced in the CI. 
- Any incorrectly formatted code will be reported by `yarn run lint`.
- Use `yarn run format` to apply the changes.

[irmin]: https://github.com/mirage/irmin/
[irmin.io]: https://irmin.io/
[tutorial-dir]: https://github.com/mirage/irmin.io/tree/master/data/tutorial/
[prettier]: https://github.com/prettier/prettier/
[gatsby]: https://www.gatsbyjs.org/
