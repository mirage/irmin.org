import React from "react";

import Layout from "../components/layout";

import { StaticQuery, graphql } from 'gatsby';
import ReactMarkdown from "react-markdown"

const query = graphql`
  query {
    strapiIrminAbout {
      content
    }
  }
`;

class AboutPage extends React.Component {

  render() {
    return (
      <Layout title="Irmin">

        <div className="wrapper">
          <section className="doc">

<StaticQuery
    query={query}
    render={data => (
      <div>
        <ReactMarkdown children={data.strapiIrminAbout.content} />
      </div>
    )}
  />

          </section>
        </div>
      </Layout>
    );
  }
}

export default AboutPage;
