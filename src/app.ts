// Import React and ReactDOM
import React from "react";
import { createRoot } from "react-dom/client";

import "zmp-ui/zaui.css";
import "./css/tailwind.css";
import "./css/app.scss";

// Import App Component
import App from "./components/app";
// Mount React App
const root = createRoot(document.getElementById("app")!);
root.render(React.createElement(App));
