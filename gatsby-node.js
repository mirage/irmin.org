const path = require(`path`);

const tutorialTemplate = path.resolve(`src/templates/tutorial.js`);

exports.createPages = async ({ graphql, actions, reporter }) => {
  const { createPage } = actions;

  const result = await graphql(`
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
  `);

  if (result.errors) {
    reporter.panicOnBuild(
      `There was an error loading tutorials`,
      result.errors,
    );
    return;
  }

  const tutorials = result.data.allMarkdownRemark.edges;

  tutorials.forEach(({ node }) => {
    const { path } = node.frontmatter;
    createPage({
      path,
      component: tutorialTemplate,
      context: { id: path },
    });
  });
};
