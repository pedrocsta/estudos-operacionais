import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Questions from "./pages/Questions.jsx"; // (página simples para listar questões)

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />  // Tela de login/cadastro
  },
  {
    path: "/home",
    element: <Home /> // Tela após login
  },
  {
    path: "/questions",
    element: <Questions /> // Tela para exibir as questões do questoes.db
  }
]);

export default function Routes() {
  return <RouterProvider router={router} />;
}
