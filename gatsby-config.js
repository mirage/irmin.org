const path = require(`path`);

module.exports = {
  siteMetadata: {
    title: "Tarides",
    description: "",
    author: "@tarides"
  },
  plugins: [
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/src/tutorial`,
        name: `tutorial`
      }
    },
    `gatsby-transformer-remark`
  ]
};
