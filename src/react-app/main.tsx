import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";

// Error reporting for blank screen issues
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", { message, source, lineno, colno, error });
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Error de Aplicación</h1>
      <p>${message}</p>
      <pre>${error?.stack || ''}</pre>
    </div>
  `;
};

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("Fatal: No se encontró el elemento #root");
  document.body.innerHTML = "<h1>Error Fatal: No se encontró el contenedor de la app.</h1>";
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (err) {
    console.error("Error during rendering:", err);
  }
}
