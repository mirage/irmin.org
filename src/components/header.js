import { Link } from "gatsby";
import React from "react";

import Logo from "../images/logo_white.svg";

import "./header.css";

const Header = () => (
  <header>
    <nav className="menu">
      <ul>
        <li>
          <a href="https://github.com/mirage/irmin">Github</a>
        </li>
        <li>
          <Link to="/tutorial/introduction">Tutorial</Link>
        </li>
        <li>
          <a href="https://mirage.github.io/irmin">API</a>
        </li>
      </ul>
    </nav>
    <div className="logo">
      <Link to="/">
        <img src={Logo} alt="Irmin logo" />
      </Link>
    </div>
  </header>
);

export default Header;
