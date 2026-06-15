import React from "react";
import { createRoot } from "react-dom/client";
import Companion from "./components/Companion.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Companion />
  </React.StrictMode>
);
