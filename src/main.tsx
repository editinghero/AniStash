import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  const registerSW = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
      .catch((err) => console.error("Service Worker registration failed:", err));
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    registerSW();
  } else {
    window.addEventListener("load", registerSW);
  }
}
