import React from "react";
import Prism from "prismjs";
import "prismjs/components/prism-ocaml";
import "prismjs/components/prism-shell-session";
import { Link } from "gatsby";

import HomeHeader from "../components/home/homeHeader";
import HomeFeatureGrid from "../components/home/homeFeatureGrid";
import Layout from "../components/layout";

import imgTutorial from "../images/icons/tutorial.png";
import imgIssue from "../images/icons/issue.png";
import imgLicense from "../images/icons/license.png";

import exampleCode from "raw-loader!../data/example.ml";

class HomePage extends React.Component {
  componentDidMount() {
    Prism.highlightAll();
  }

  render() {
    return (
      <Layout title="Irmin">
        <HomeHeader />
        <HomeFeatureGrid />

        <div className="wrapper">
          <section className="doc">
            <div className="colleft">
              <h2>Installation</h2>
              <p>
                To install Irmin, the command-line tool and all optional
                dependencies using opam:
              </p>
              <pre>
                <code className="language-shell-session">
                  $ opam install irmin-unix
                </code>
              </pre>

              <p>
                A minimal installation, with no storage backends can be
                installed by running:
              </p>
              <pre>
                <code className="language-shell-session">
                  $ opam install irmin
                </code>
              </pre>

              <p>To only install the in-memory storage backend:</p>
              <pre>
                <code className="language-shell-session">
                  $ opam install irmin-mem
                </code>
              </pre>
              <br />
              <br />
              <br />
            </div>

            <div className="colright">
              <br />
              <br />
              <br />
              <p>The following packages have been made available on opam:</p>

              <ul>
                <li>
                  <code>irmin</code> - the base package, no storage
                  implementations
                </li>
                <li>
                  <code>irmin-chunk</code> - chunked storage
                </li>
                <li>
                  <code>irmin-fs</code> - filesystem-based storage using
                  bin_prot
                </li>
                <li>
                  <code>irmin-git</code> - Git compatible storage
                </li>
                <li>
                  <code>irmin-http</code> - a simple REST interface
                </li>
                <li>
                  <code>irmin-mem</code> - in-memory storage implementation
                </li>
                <li>
                  <code>irmin-mirage</code> - mirage compatibility
                </li>
                <li>
                  <code>irmin-unix</code> - unix compatibility
                </li>
              </ul>

              <p>
                For more information about an individual package consult the
                online documentation.
              </p>
            </div>
          </section>

          <div className="clearfix" />

          <section className="doc">
            <h2>Examples</h2>
            <p>
              Below is a simple example of setting a key and getting the value
              out of a Git based, filesystem-backed store.
            </p>

            <pre>
              <code
                className="language-ocaml"
                dangerouslySetInnerHTML={{ __html: exampleCode }}
              />
            </pre>

            <p>
              To compile the example above, save it to a file called{" "}
              <code>example.ml</code>
              and run:
            </p>
            <pre>
              <code className="language-shell-session">
                {`$ ocamlfind ocamlopt example.ml -o example -package irmin-unix,lwt.unix -linkpkg
$ ./example
foo/bar => 'testing 123'`}
              </code>
            </pre>

            <p>
              The examples directory contains some more advanced examples. The
              build them, run:
            </p>
            <pre>
              <code className="language-shell-session">
                {`$ jbuilder build examples/trees.exe
$ _build/default/examples/trees.exe`}
              </code>
            </pre>

            <h2>Command-line</h2>
            <p>
              The same thing can also be accomplished using irmin, the
              command-line application installed with irmin-unix, by running:
            </p>

            <pre>
              <code className="language-shell-session">
                {`$ echo "root: ." > irmin.yml
$ irmin init
$ irmin set foo/bar "testing 123"
$ irmin get foo/bar`}
              </code>
            </pre>

            <p>
              <code>irmin.yml</code> allows for irmin flags to be set on a
              per-directory basis. You can also set flags globally using{" "}
              <code>$HOME/.irmin/config.yml</code>.{" "}
            </p>

            <p>
              Run <code>irmin help irmin.yml</code> for further details.
            </p>

            <h2>Explore further</h2>

            <p>
              <Link to="/tutorial/introduction" className="button tutorial">
                <img src={imgTutorial} alt="" /> Tutorial
              </Link>
              <a
                className="button issue"
                href="https://github.com/mirage/irmin/issues"
              >
                <img src={imgIssue} alt="" /> Issues
              </a>
              <a
                className="button license"
                href="https://github.com/mirage/irmin/blob/master/LICENSE.md"
              >
                <img src={imgLicense} alt="" /> License
              </a>
            </p>
            <p>
              Irmin is part of the <a href="https://mirage.io">MirageOS</a>
              project and supported by
              <a href="https://tarides.com">Tarides</a>
              and <a href="https://robur.io">Robur</a>
              and <a href="https://ocamllabs.io">OCaml Labs</a>.
            </p>
          </section>
        </div>
      </Layout>
    );
  }
}

export default HomePage;
