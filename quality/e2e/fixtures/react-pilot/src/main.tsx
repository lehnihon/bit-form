import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { BenchmarkCompareApp } from "./benchmark-compare";

const search = new URLSearchParams(window.location.search);
const isBenchmarkMode = search.get("bench") === "compare";

createRoot(document.getElementById("root")!).render(
  isBenchmarkMode ? (
    <BenchmarkCompareApp />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ),
);
