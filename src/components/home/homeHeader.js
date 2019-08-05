import { Link } from "gatsby";
import React from "react";

import imgLogo from "../../images/logo.png";
import imgGithub from "../../images/icons/github.svg";

const HomeHeader = ({ pages, currentLink }) => {
  return (
    <section className="intro wrapper">
      <div className="logo">
        <Link to="/">
          <img className="logo" src={imgLogo} alt="Irmin logo" />
        </Link>
        <h1>A distributed database built on the same principles as Git</h1>
        <a href="https://github.com/mirage/irmin" className="button github">
          <img src={imgGithub} alt="Github" />
          Github
        </a>
        <Link to="/tutorial/introduction" className="button dark">
          Get Started
        </Link>
      </div>
    </section>
  );
};

export default HomeHeader;
