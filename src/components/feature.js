import React from "react";

const Feature = ({ feature }) => {
  let { image, alt, title, body } = feature;

  return (
    <div className="feature">
      <img src={image} alt={alt} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
};

export default Feature;
