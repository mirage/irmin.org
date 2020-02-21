const path = require(`path`);

exports.createPages = ({ actions, graphql }) => {
  const { createPage } = actions;

  const tutorialTemplate = path.resolve(`src/templates/tutorial.js`);

  return graphql(`
    {
      allMarkdownRemark(limit: 1000) {
        edges {
          node {
            frontmatter {
              path
            }
          }
        }
      }
    }
  `).then(result => {
    if (result.errors) {
      return Promise.reject(result.errors);
    }

    return result.data.allMarkdownRemark.edges.forEach(({ node }) => {
      let path = node.frontmatter.path;

      // Trim the leading slash when present.
      if (path.substr(0, 1) == '/') {
        path = path.substr(1);
      }

      createPage({
        path,
        component: tutorialTemplate,
        context: {} // additional data can be passed via context
      });
    });
  });
};
