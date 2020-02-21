import React from "react";
import { graphql } from "gatsby";

import Layout from "../components/layout";
import TutorialSidebar from "../components/tutorial/tutorialSidebar";
import TutorialFooter from "../components/tutorial/tutorialFooter";

import "./tutorial.css";

export default function Template({ data }) {
  const { markdownRemark } = data;
  const { frontmatter, html } = markdownRemark;

export default function Template({ data: { allPages, currentPage } }) {
  const { frontmatter, html } = currentPage;

  // Fetch the list of pages dynamically.
  const pages = allPages.edges.map(edge => {
    const {node: {frontmatter: {path: link, title}}} = edge;
    return {link, title};
  });

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
    allPages: allMarkdownRemark(limit: 1000) {
      edges {
        node {
          frontmatter {
            path
            title
          }
        }
      }
    },

    currentPage: markdownRemark(frontmatter: { path: { eq: $path } }) {
      html
      frontmatter {
        path
        title
      }
    }
  }
`;
