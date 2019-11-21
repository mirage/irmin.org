import React from "react";

import "./homeFeature.css";

const HomeFeature = ({ feature }) => {
  let { image, alt, title, body } = feature;

  return (
    <div className="feature">
      <img src={image} alt={alt} />
      <h3>{title}</h3>
      <p dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
};

export default HomeFeature;
