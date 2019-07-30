import React from "react";

import Header from "./header";

import "./css/main.css";

const Layout = ({ children }) => (
  <>
    <Header />
    <>{children}</>
  </>
);

export default Layout;
