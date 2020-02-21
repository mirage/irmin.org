import React from "react";
import RehypeReact from "rehype-react";
import { graphql } from "gatsby";

import Layout from "../components/layout";
import Wizard from "../components/widgets/wizard";
import TutorialSidebar from "../components/tutorial/tutorialSidebar";
import TutorialFooter from "../components/tutorial/tutorialFooter";

import "./tutorial.css";

/** React components which will be allowed inside Mardown files. */
const components = {};

// Compile a rehype AST into a React tree.
const compile = new RehypeReact({
  createElement: React.createElement,
  components,
}).Compiler;

// Remove <p> tags around custom React components.
const unwrap = tree => {
  if (tree.type === 'root') {
    return {
      ...tree,
      children: tree.children.map(c => {
        if (c.type === 'element' &&
            c.tagName === 'p' &&
            c.children.length === 1 &&
            c.children[0].type === 'element' &&
            c.children[0].tagName in components)
            return c.children[0];
        return c;
      }),
    };
  } else {
    return tree;
  }
};

export default function Template({ data: { allPages, currentPage } }) {
  const { frontmatter, htmlAst: ast } = currentPage;

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
            <div className="content">
              { compile(unwrap(ast)) }
            </div>
            <TutorialFooter pages={pages} currentLink={frontmatter.path} />
          </section>
        </div>
      </Layout>
    </div>
  );
}

export const pageQuery = graphql`
  query($path: String!) {
    allPages: allMarkdownRemark(sort: {fields: fileAbsolutePath}) {
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
      htmlAst
      frontmatter {
        path
        title
      }
    }
  }
`;
