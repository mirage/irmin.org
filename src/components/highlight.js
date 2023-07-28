import React, { useEffect } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-ocaml";
import "prismjs/components/prism-shell-session";

const Highlight = ({ children }) => {
  useEffect(() => {
    Prism.highlightAll();
  });
  return <>{children}</>;
};

export default Highlight;
