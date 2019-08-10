import { Link } from "gatsby";
import React from "react";

import "./tutorialFooter.css";

const TutorialFooter = ({ pages, currentLink }) => {
  const curr = pages.findIndex(i => i.link === currentLink);
  const prev = pages[curr - 1] ? pages[curr - 1] : null;
  const next = pages[curr + 1] ? pages[curr + 1] : null;

  return (
    <>
      {next && (
        <Link to={next.link} className="next">
          Next: {next.title}
        </Link>
      )}
      {prev && (
        <Link to={prev.link} className="previous">
          Previous: {prev.title}
        </Link>
      )}
    </>
  );
};

export default TutorialFooter;
