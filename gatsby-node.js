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
      createPage({
        path: node.frontmatter.path,
        component: tutorialTemplate,
        context: {} // additional data can be passed via context
      });
    });
  });
};
