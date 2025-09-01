import React from "react";
import Auth from "./pages/Auth.jsx";

export default function App(){
  return (
    <div className="container">
      <div className="header">
        <h2>Estudo Operacional</h2>
        <div className="caption">Acesse sua conta para ver seu painel de estudos.</div>
      </div>
      <Auth />
    </div>
  );
}
