import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { RateProvider } from "./RateContext.jsx";
import { LoadingProvider } from "./LoadingContext.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <RateProvider>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </RateProvider>
    </HashRouter>
  </React.StrictMode>
);
