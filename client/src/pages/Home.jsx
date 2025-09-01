import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AngleDown from "../assets/angle-down.svg";
import AngleUp from "../assets/angle-up.svg";
import Streak from "../components/StreakCard.jsx";


export default function Home() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  // fecha o popover ao clicar fora
  useEffect(() => {
    function onClickOutside(e) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const logout = () => {
    localStorage.removeItem("user");
    setOpen(false);
    navigate("/");
  };

  const onAddStudy = () => {
    // TODO: abrir modal/adicionar estudo
    console.log("Adicionar Estudo");
  };

  return (
    <div className="container">
      {/* TOPBAR */}
      <div className="home-topbar">
        <h2>Home</h2>

        {/* bloco da direita: chip + botão abaixo */}
        <div className="user-block">
          <div className="user-pop" ref={popRef}>
            <button
              type="button"
              className={`btn btn-outline user-chip-btn ${open ? "active" : ""}`}
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
            >
              <span className="user-chip-text">
                {user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Usuário"}
              </span>
              <img
                src={open ? AngleUp : AngleDown}
                alt=""
                aria-hidden="true"
                className="user-chip-caret"
                draggable="false"
              />
            </button>

            {open && (
              <div className="menu-popover" role="menu">
                <button className="btn btn-outline full" onClick={logout}>
                  Sair
                </button>
              </div>
            )}
          </div>

          {/* Botão tipo 1 (sólido) abaixo do chip */}
          <button className="btn btn-solid add-study-btn" onClick={onAddStudy}>
            Adicionar Estudo
          </button>
        </div>
      </div>

      <div className="divider" />

      {/* GRID dos cards (estrutura) */}
      <div className="home-grid-areas">
        <Streak />

        <section className="card bare" data-area="painel">
          <h3 className="card-title">Painel</h3>
        </section>

        <section className="card bare" data-area="metas">
          <h3 className="card-title">Metas de estudo semanal</h3>
        </section>

        <section className="card bare" data-area="weekly">
          <h3 className="card-title">Estudos semanal</h3>
        </section>

        <section className="card bare" data-area="day">
          <h3 className="card-title">Estudos do dia</h3>
        </section>
      </div>
    </div>
  );
}
