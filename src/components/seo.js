import React from "react";
import { useSiteMetadata } from "../hooks/use-site-metadata";

const SEO = ({ title, description, children }) => {
  const {
    title: defaultTitle,
    description: defaultDescription,
    twitterUsername,
  } = useSiteMetadata();
  const seo = {
    title: title || defaultTitle,
    description: description || defaultDescription,
    twitterUsername,
  };

  return (
    <>
      <title>{seo.title}</title>
      <meta name="og:type" contents="website" />
      <meta name="og:title" contents={seo.title} />
      <meta name="description" content={seo.description} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:creator" content={seo.twitterUsername} />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      {children}
    </>
  );
};

export default SEO;
