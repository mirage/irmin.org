import { Link } from "gatsby";
import React from "react";

import imgLogo from "../../images/logo.svg";
import imgGithub from "../../images/icons/github.svg";

import "./homeHeader.css";

const HomeHeader = ({ pages, currentLink }) => {
  return (
    <section className="home-header wrapper">
      <div className="logo">
        <Link to="/">
          <img className="logo" src={imgLogo} alt="Irmin logo" />
        </Link>
        <h1>A distributed database built on the same principles as Git</h1>
        <a href="https://ci.ocamllabs.io/github/mirage/irmin" className="build">
          <img
            src="https://img.shields.io/endpoint?url=https%3A%2F%2Fci.ocamllabs.io%2Fbadge%2Fmirage%2Firmin%2Fmaster&logo=ocaml\&style=for-the-badge"
            alt="OCaml-CI Status"
          />
        </a>
        <br />
        <a href="https://github.com/mirage/irmin" className="button github">
          <img src={imgGithub} alt="GitHub" />
          GitHub
        </a>
        <Link to="/tutorial/introduction" className="button dark">
          Get Started
        </Link>
      </div>
    </section>
  );
};

export default HomeHeader;
