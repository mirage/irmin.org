import React from "react";

import HomeFeature from "./homeFeature";

import imgSnapshot from "../../images/icons/snapshot.png";
import imgStorage from "../../images/icons/storage.png";
import imgDatatype from "../../images/icons/datatype.png";
import imgPortable from "../../images/icons/portable.png";
import imgGit from "../../images/icons/git.png";
import imgBehavior from "../../images/icons/behavior.png";

import "./homeFeatureGrid.css";

const HomeFeatureGrid = () => {
  let features = [
    {
      image: imgSnapshot,
      alt: "Built-in snapshotting",
      title: "Built-in snapshotting",
      body: "Backup and restore your data at any point in time.",
    },
    {
      image: imgStorage,
      alt: "Storage agnostic",
      title: "Storage agnostic",
      body: "You can use Irmin on top of your own storage layer.",
    },
    {
      image: imgDatatype,
      alt: "Custom datatypes",
      title: "Custom datatypes",
      body: "Automatic (de)serialization for custom data types.",
    },
    {
      image: imgPortable,
      alt: "Highly portable",
      title: "Highly portable",
      body: "Runs anywhere from Linux to web browsers and Xen unikernels.",
    },
    {
      image: imgGit,
      alt: "Git compatibility",
      title: "Git compatibility",
      body: "Bi-directional compatibility with the Git on-disk format. Irmin state can be inspected and modified using the Git command-line tool.",
    },
    {
      image: imgBehavior,
      alt: "Dynamic behavior",
      title: "Dynamic behavior",
      body: "Allows users to define custom merge functions and create event-driven workflows using a notification mechanism.",
    },
  ];

  return (
    <section className="home-feature-grid wrapper">
      <h2>
        Irmin is an OCaml library for building mergeable, branchable distributed
        data stores.
      </h2>
      <div className="list">
        {features.map((f) => {
          return <HomeFeature key={f.title} feature={f} />;
        })}
      </div>
    </section>
  );
};

export default HomeFeatureGrid;
