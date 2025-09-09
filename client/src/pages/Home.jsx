import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Streak from "../components/StreakCard.jsx";
import Painel from "../components/Painel.jsx";
import AddStudyDialog from "../components/AddStudyDialog.jsx";
import WeeklyGoals from "../components/WeeklyGoals.jsx";
import WeeklyStudyChart from "../components/WeeklyStudyChart.jsx";
import DailyStudies from "../components/DailyStudies.jsx";
import StudyTimerDialog from "../components/StudyTimerDialog.jsx";

import AngleRight from "../assets/icons/angle-right.svg";
import TrashIcon from "../assets/icons/trash.svg";
import AngleDown from "../assets/icons/angle-down.svg";
import AngleUp from "../assets/icons/angle-up.svg";

import PlayIcon from "../assets/icons/play.svg";
import PauseIcon from "../assets/icons/pause.svg";
import StopIcon from "../assets/icons/stop.svg";
import RestartIcon from "../assets/icons/restart.svg";
import MaximizeIcon from "../assets/icons/maximize.svg";

import useSharedTimer, { fmtHMS } from "../hooks/useSharedTimer.js";

const API_BASE = import.meta.env.VITE_API_URL || ""; // "" => mesmo host (proxy)

// util: minutos -> "Xh Ymin"
function fmtDuration(min) {
  const n = Number(min) || 0;
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export default function Home() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showTimer, setShowTimer] = useState(false);

  // ===== Timer compartilhado (fonte única) =====
  const { running, elapsedSec, onToggle, onReset, stop } = useSharedTimer({
    onStop: (hhmmss) => {
      // STOP vindo do dialog de timer
      setPrefillDuration(hhmmss);
      setShowDialog(true);
    },
  });

  // duração para pré-preencher o AddStudyDialog quando vier do cronômetro
  const [prefillDuration, setPrefillDuration] = useState("00:00:00");

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

  // STOP pela toolbar do Home → consolida, abre AddStudyDialog
  function handleStopFromToolbar() {
    setPrefillDuration(fmtHMS(elapsedSec));
    stop(); // consolida e pausa
    setShowDialog(true);
  }

  /* ================== ESTATÍSTICAS (somente para MASTER) ================== */
  const isMaster =
    typeof user?.email === "string" &&
    user.email.toLowerCase() === "pedrohdcosta@outlook.com";

  const [stats, setStats] = useState({ usersCount: 0, totalMinutes: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState("");

  useEffect(() => {
    if (!open || !isMaster) return; // só busca se o popover abrir E for master
    let aborted = false;

    async function fetchStats() {
      try {
        setStatsLoading(true);
        setStatsErr("");
        const res = await fetch(`${API_BASE}/api/stats/overview`, {
          headers: { "x-admin-email": "pedrohdcosta@outlook.com" },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!aborted) {
          setStats({
            usersCount: Number(data?.usersCount) || 0,
            totalMinutes: Number(data?.totalMinutes) || 0,
          });
        }
      } catch (e) {
        console.error(e);
        if (!aborted) setStatsErr("Não foi possível carregar as estatísticas.");
      } finally {
        if (!aborted) setStatsLoading(false);
      }
    }

    fetchStats();
    return () => { aborted = true; };
  }, [open, isMaster]);
  /* ================== FIM ESTATÍSTICAS MASTER ================== */

  // ===== Excluir conta =====
  const [deleting, setDeleting] = useState(false);
  async function handleDeleteAccount() {
    if (!user?.id) return alert("Sessão inválida.");
    const ok = window.confirm(
      "Tem certeza que deseja excluir sua conta? Essa ação é permanente e não pode ser desfeita."
    );
    if (!ok) return;

    try {
      setDeleting(true);
      const resp = await fetch(`${API_BASE}/api/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = payload?.error || payload?.message || `Erro ao excluir conta (HTTP ${resp.status}).`;
        alert(msg);
        return;
      }
      // limpa sessão e vai para a tela inicial
      localStorage.removeItem("user");
      navigate("/");
    } catch (e) {
      console.error(e);
      alert("Não foi possível excluir a conta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="container">
      {/* TOPBAR */}
      <div className="home-topbar">
        <h2>Home</h2>

        <div className="user-block">
          <div className="user-pop" ref={popRef}>
            <button
              type="button"
              className={`btn btn-outline user-chip-btn ${open ? "active" : ""}`}
              onClick={() => setOpen((v) => !v)}
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
                {/* ====== MOSTRA SÓ PARA O MASTER ====== */}
                {isMaster && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#aaa",
                      marginBottom: "8px",
                      wordBreak: "break-all",
                    }}
                  >
                    {statsLoading && <div>Carregando estatísticas…</div>}
                    {!statsLoading && statsErr && (
                      <div style={{ color: "#ff9b9b" }}>{statsErr}</div>
                    )}
                    {!statsLoading && !statsErr && (
                      <>
                        <div>Total de usuários: <b>{stats.usersCount}</b></div>
                        <div>Horas estudadas (total): <b>{fmtDuration(stats.totalMinutes)}</b></div>
                      </>
                    )}
                  </div>
                )}
                {/* ====== FIM BLOCO MASTER ====== */}

                {user?.id && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#aaa",
                      marginBottom: "8px",
                      wordBreak: "break-all",
                    }}
                  >
                    ID: {user.id}
                  </div>
                )}

                <button className="btn btn-outline full" onClick={logout}>
                  Sair
                </button>
              </div>
            )}
          </div>

          {/* ===== Toolbar em CONTAINER (#1A1A1A) antes do Adicionar Estudo ===== */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Container dos botões */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 5,
                background: "#1A1A1A",
                borderRadius: 8,
                border: "none",
              }}
            >
              {/* Play/Pause (mesmo estilo do diálogo) */}
              <button
                className={`btn-dialog-time ${running ? "pause-btn-dialog" : "play-btn-dialog"}`}
                onClick={onToggle}
                title={running ? "Pausar" : "Iniciar"}
                aria-label={running ? "Pausar" : "Iniciar"}
              >
                <img src={running ? PauseIcon : PlayIcon} alt=""/>
              </button>

              {/* Stop */}
              <button
                className="btn-dialog-time"
                onClick={handleStopFromToolbar}
                title="Parar e salvar"
                aria-label="Parar e salvar"
              >
                <img src={StopIcon} alt="" />
              </button>

              {/* Restart */}
              <button
                className="btn-dialog-time"
                onClick={onReset}
                disabled={elapsedSec === 0}
                title="Reiniciar"
                aria-label="Reiniciar"
                style={{
                  opacity: elapsedSec === 0 ? 0.5 : 1,
                }}
              >
                <img src={RestartIcon} alt="" />
              </button>

              {/* Tempo */}
              <div
                style={{ fontSize: 24 }}
                aria-label="Tempo decorrido"
              >
                {fmtHMS(elapsedSec)}
              </div>

              {/* Expandir (abre dialog sincronizado) */}
              <button
                className="btn-dialog-time"
                onClick={() => setShowTimer(true)}
                title="Expandir cronômetro"
                aria-label="Expandir cronômetro"
              >
                <img src={MaximizeIcon} alt="" />
              </button>
            </div>

            {/* Adicionar Estudo (fora do container) */}
            <button
              className="btn btn-solid add-study-btn"
              onClick={() => {
                setPrefillDuration("00:00:00");
                setShowDialog(true);
              }}
              style={{ marginLeft: 4 }}
            >
              Adicionar Estudo
            </button>
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* GRID dos cards */}
      <div className="home-grid-areas">
        <Streak />

        <section className="card bare" data-area="painel">
          <h3 className="card-title">Painel</h3>
          <Painel userId={user?.id} />
        </section>

        <section className="card bare" data-area="metas">
          <WeeklyGoals userId={user?.id} />
        </section>

        <section className="card bare" data-area="weekly">
          <WeeklyStudyChart userId={user?.id} />
        </section>

        <div className="card bare" data-area="day">
          <DailyStudies userId={user?.id} />
        </div>
      </div>

      {/* LISTA INLINE – ao final da página */}
      <section className="card bare" style={{ marginTop: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 16 }}>Meus Registros de Estudo</h3>
        <StudiesInline userId={user?.id} />
      </section>

      {/* ===== Botão Excluir conta (outline, 100% width) ===== */}
      <div style={{ marginTop: 16 }}>
        <button
          className="btn btn-outline"
          onClick={handleDeleteAccount}
          disabled={deleting}
          style={{ width: "100%", color: "#8a3a3a", borderColor: "#8a3a3a" }}
          title="Excluir conta permanentemente"
          aria-label="Excluir conta"
        >
          {deleting ? "Excluindo..." : "Excluir conta"}
        </button>
      </div>

      {/* Dialogs (sincronizados) */}
      {showTimer && (
        <StudyTimerDialog
          onClose={() => setShowTimer(false)}
          onStop={(hhmmss) => {
            // mantém compatibilidade: se o dialog der stop, já abre o AddStudyDialog
            setPrefillDuration(hhmmss || fmtHMS(elapsedSec));
            setShowDialog(true);
          }}
        />
      )}

      {showDialog && (
        <AddStudyDialog
          onClose={() => setShowDialog(false)}
          userId={user?.id}
          initialDuration={prefillDuration}
        />
      )}
    </div>
  );
}

/* ================== Lista Inline ================== */
function StudiesInline({ userId }) {
  const [items, setItems] = useState([]); // vem de data.items
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const hasData = items.length > 0;

  const fetchList = React.useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setErr("");

      const qs = new URLSearchParams({
        userId,
        order: "desc",
        limit: "50",
        offset: "0",
      }).toString();

      const res = await fetch(`${API_BASE}/api/studies?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
    } catch (e) {
      console.error(e);
      setErr("Não foi possível carregar os registros.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const onChange = () => fetchList();
    window.addEventListener("study:created", onChange);
    window.addEventListener("study:deleted", onChange);
    window.addEventListener("study:updated", onChange);
    return () => {
      window.removeEventListener("study:created", onChange);
      window.removeEventListener("study:deleted", onChange);
      window.removeEventListener("study:updated", onChange);
    };
  }, [fetchList]);

  async function handleDelete(id) {
    try {
      const res = await fetch(`${API_BASE}/api/studies/${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      window.dispatchEvent(new CustomEvent("study:deleted", { detail: { id } }));
    } catch (e) {
      console.error(e);
      alert("Não foi possível excluir este registro.");
    }
  }

  if (loading) return <p className="text-sm" style={{ opacity: 0.8 }}>Carregando…</p>;
  if (err) return <p className="text-sm" style={{ color: "#ff9b9b" }}>{err}</p>;
  if (!hasData) return <p className="text-sm" style={{ opacity: 0.8 }}>Nenhum registro ainda.</p>;

  return (
    <div className="studies-list">
      {items.map((it) => (
        <StudyAccordionItem key={it.id} item={it} onDelete={() => handleDelete(it.id)} />
      ))}
    </div>
  );
}

/* Item tipo accordion */
function StudyAccordionItem({ item, onDelete }) {
  const [open, setOpen] = useState(false);

  const subjectName = item.subject?.name || item.subjectName || "";
  const headerText = `${(item.studyDate || "").slice(0, 10)} - ${labelFromCategory(
    item.category
  )}: ${subjectName}`;

  return (
    <div className="study-acc">
      <button
        type="button"
        className="study-acc__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <img
          src={open ? AngleDown : AngleRight}
          alt=""
          aria-hidden="true"
          className="caret-icon"
          draggable="false"
        />
        <span>{headerText}</span>
      </button>

      <button
        type="button"
        className="delete-btn"
        title="Excluir registro"
        aria-label="Excluir registro"
        onClick={() => onDelete(item.id)}
      >
        <img src={TrashIcon} alt="Excluir" draggable="false" />
      </button>

      {open && (
        <div className="study-acc__body">
          <p><b>Duração:</b> {fmtDuration(item.durationMin)}</p>

          {(item.questionsRight || item.questionsWrong) ? (
            <p>
              <b>Questões:</b> {item.questionsRight || 0} acertos / {item.questionsWrong || 0} erros
            </p>
          ) : null}

          {(item.pageStart || item.pageEnd) ? (
            <p>
              <b>Páginas:</b> {item.pageStart ?? "-"} até {item.pageEnd ?? "-"}
            </p>
          ) : null}

          {item.comment ? <p><b>Comentário:</b> {item.comment}</p> : null}

          {item.createdAt && (
            <p className="muted">Salvo em {new Date(item.createdAt).toLocaleString("pt-BR")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ===== Helper mantido aqui para evitar ReferenceError ===== */
function labelFromCategory(cat) {
  switch (cat) {
    case "teoria": return "Teoria";
    case "revisao": return "Revisão";
    case "exercicio": return "Questões";
    case "leitura": return "Leitura de Lei";
    case "jurisprudencia": return "Jurisprudência";
    default: return cat || "";
  }
}
