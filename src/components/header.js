import { Link } from "gatsby";
import React from "react";

import Logo from "../images/logo_white.png";

const Header = () => (
  <header>
    <nav class="menu">
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
        <li>
          <Link to="#">News</Link>
        </li>
      </ul>
    </nav>
    <div class="logo">
      <Link to="/">
        <img src={Logo} alt="Irmin logo" />
      </Link>
    </div>
  </header>
);

export default Header;
