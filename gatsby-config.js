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
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [`gatsby-remark-autolink-headers`]
      }
    }
  ]
};
