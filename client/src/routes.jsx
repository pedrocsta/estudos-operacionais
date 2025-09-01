import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />  // Tela de login/cadastro
  },
  {
    path: "/home",
    element: <Home /> // Tela após login
  }
]);

export default function Routes() {
  return <RouterProvider router={router} />;
}
