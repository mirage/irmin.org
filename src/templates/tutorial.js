import React from "react";
import { graphql } from "gatsby";

import Layout from "../components/layout";
import TutorialSidebar from "../components/tutorial/tutorialSidebar";
import TutorialFooter from "../components/tutorial/tutorialFooter";

import "./tutorial.css";

export default function Template({ data }) {
  const { markdownRemark } = data;
  const { frontmatter, html } = markdownRemark;

  // TODO: get this list dynamically
  const pages = [
    { link: "/tutorial/introduction", title: "Introduction" },
    { link: "/tutorial/command-line", title: "Using the command-line" },
    {
      link: "/tutorial/getting-started",
      title: "Getting started with OCaml"
    },
    { link: "/tutorial/contents", title: "Custom content types" },
    {
      link: "/tutorial/architecture",
      title: "An overview of the architecture"
    },

    { link: "/tutorial/backend", title: "Writing a storage backend" },
    { link: "/tutorial/graphql", title: "GraphQL bindings" },
    { link: "/tutorial/resources", title: "Resources" }
  ];

  return (
    <div className="documentation">
      <Layout title="Tutorial">
        <div className="content-wrapper">
          <TutorialSidebar pages={pages} currentLink={frontmatter.path} />
          <section className="doc">
            <h2>{frontmatter.title}</h2>
            <div
              className="content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <TutorialFooter pages={pages} currentLink={frontmatter.path} />
          </section>
        </div>
      </Layout>
    </div>
  );
}

export const pageQuery = graphql`
  query($path: String!) {
    markdownRemark(frontmatter: { path: { eq: $path } }) {
      html
      frontmatter {
        path
        title
      }
    }
  }
`;
