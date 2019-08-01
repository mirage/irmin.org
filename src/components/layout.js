import React from "react";
import PropTypes from "prop-types";
import Helmet from "react-helmet";
import { StaticQuery, graphql } from "gatsby";

import Header from "./header";

import "./css/main.css";

class Layout extends React.Component {
  render() {
    const { title, children } = this.props;

    return (
      <StaticQuery
        query={detailsQuery}
        render={data => {
          const siteTitle = data.site.siteMetadata.title;
          const description = data.site.siteMetadata.description;
          const author = data.site.siteMetadata.author;

          return (
            <>
              <Helmet
                title={title === siteTitle ? null : title}
                defaultTitle={siteTitle}
                titleTemplate={`%s | ${siteTitle}`}
                meta={[
                  {
                    property: "og:type",
                    content: "website"
                  },
                  {
                    property: "og:title",
                    content: title
                  },
                  {
                    name: "description",
                    content: description
                  },
                  {
                    property: "og:description",
                    content: description
                  },
                  {
                    name: "twitter:card",
                    content: "summary"
                  },
                  {
                    name: "twitter:creator",
                    content: author
                  },
                  {
                    name: "twitter:title",
                    content: title
                  },
                  {
                    name: "twitter:description",
                    content: description
                  }
                ]}
              />
              <Header />
              <>{children}</>
            </>
          );
        }}
      />
    );
  }
}

Layout.propTypes = {
  title: PropTypes.string.isRequired
};

export default Layout;

const detailsQuery = graphql`
  query DefaultLayoutQuery {
    site {
      siteMetadata {
        title
        description
        author
      }
    }
  }
`;
