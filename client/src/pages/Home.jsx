import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AngleDown from "../assets/angle-down.svg";
import AngleUp from "../assets/angle-up.svg";
import Streak from "../components/StreakCard.jsx";
import Painel from "../components/Painel.jsx";
import AddStudyDialog from "../components/AddStudyDialog.jsx";
import AngleRight from "../assets/angle-right.svg";
import TrashIcon from "../assets/trash.svg";
import WeeklyGoals from "../components/WeeklyGoals.jsx";
import WeeklyStudyChart from "../components/WeeklyStudyChart.jsx";
import DailyStudies from "../components/DailyStudies.jsx";

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

          <button className="btn btn-solid add-study-btn" onClick={() => setShowDialog(true)}>
            Adicionar Estudo
          </button>
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
        <h3 className="card-title" style={{marginBottom: 16}}>Meus Registros de Estudo</h3>
        <StudiesInline userId={user?.id} />
      </section>

      {/* Dialog */}
      {showDialog && (
        <AddStudyDialog onClose={() => setShowDialog(false)} userId={user?.id} />
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

      // utiliza o contrato do teu endpoint (objeto com items)
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

  // carga inicial
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // realtime: refetch quando algo muda
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

  // item.subject já vem no include do endpoint
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
