import React, { useCallback, useEffect, useState } from "react";
import GearIcon from "../assets/icons/gear.svg";
import WeeklyGoalDialog from "./WeeklyGoalDialog.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ===== Utils ===== */

// Semana local começando no DOMINGO (00:00) e terminando no SÁBADO (23:59:59).
function getWeekRangeSundayToSaturday(now = new Date()) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 00:00 local
  const dow = base.getDay(); // 0=Dom, 1=Seg, ... 6=Sab
  const start = new Date(base);
  start.setDate(base.getDate() - dow); // volta até domingo
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6); // sábado
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function ymd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fmtHHhMMmin(totalMin) {
  const n = Number(totalMin) || 0;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}min`;
}
function pct(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

/* ===== Componente ===== */

export default function WeeklyGoals({ userId }) {
  const [loading, setLoading] = useState(false);

  const [studiedMin, setStudiedMin] = useState(0);
  const [questionsTotal, setQuestionsTotal] = useState(0);

  // Metas (0 por padrão até o usuário definir no diálogo)
  const [hoursTargetMin, setHoursTargetMin] = useState(0);
  const [questionsTarget, setQuestionsTarget] = useState(0);

  const [openGoalDialog, setOpenGoalDialog] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1) Buscar metas do usuário (0/0 se não houver)
      try {
        const r = await fetch(
          `${API_BASE}/api/goals/weekly-setting?userId=${encodeURIComponent(userId)}`
        );
        if (r.ok) {
          const g = await r.json().catch(() => ({}));
          setHoursTargetMin(Number(g?.hoursTargetMin) || 0);
          setQuestionsTarget(Number(g?.questionsTarget) || 0);
        } else {
          setHoursTargetMin(0);
          setQuestionsTarget(0);
        }
      } catch {
        setHoursTargetMin(0);
        setQuestionsTarget(0);
      }

      // 2) Somar progresso da semana atual (Dom→Sáb)
      const { start, end } = getWeekRangeSundayToSaturday(new Date());
      const qs = new URLSearchParams({
        userId,
        from: ymd(start),
        to: ymd(end), // seu GET /api/studies trata "to" como inclusivo internamente
        order: "desc",
        limit: "200",
        offset: "0",
      }).toString();

      const res = await fetch(`${API_BASE}/api/studies?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const items = Array.isArray(data.items) ? data.items : [];

      let minSum = 0;
      let qSum = 0;
      for (const it of items) {
        minSum += Number(it.durationMin) || 0;
        qSum += (Number(it.questionsRight) || 0) + (Number(it.questionsWrong) || 0);
      }
      setStudiedMin(minSum);
      setQuestionsTotal(qSum);
    } catch (e) {
      console.error(e);
      setStudiedMin(0);
      setQuestionsTotal(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // realtime: refetch quando estudos ou metas mudarem
  useEffect(() => {
    const onChange = () => load();
    window.addEventListener("study:created", onChange);
    window.addEventListener("study:deleted", onChange);
    window.addEventListener("study:updated", onChange);
    window.addEventListener("goals:updated", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("study:created", onChange);
      window.removeEventListener("study:deleted", onChange);
      window.removeEventListener("study:updated", onChange);
      window.removeEventListener("goals:updated", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [load]);

  const hoursPct = pct(studiedMin, hoursTargetMin);
  const questPct = pct(questionsTotal, questionsTarget);

  return (
    <section className="weekly-goals">
      <header className="wg-head">
        <h4 className="card-title">Metas de Estudo Semanal</h4>
        <button
          type="button"
          className="wg-gear"
          title="Configurações"
          aria-label="Configurações"
          onClick={() => setOpenGoalDialog(true)}
        >
          <img src={GearIcon} alt="" draggable="false" />
        </button>
      </header>

      <div className="wg-row">
        <div className="wg-label">Horas de Estudo</div>
        <div className="wg-amount">
          {fmtHHhMMmin(studiedMin)}/{fmtHHhMMmin(hoursTargetMin)}
        </div>
        <Progress value={hoursPct} loading={loading} />
      </div>

      <div className="wg-row">
        <div className="wg-label">Questões</div>
        <div className="wg-amount">
          {questionsTotal}/{questionsTarget}
        </div>
        <Progress value={questPct} loading={loading} />
      </div>

      {openGoalDialog && (
        <WeeklyGoalDialog userId={userId} onClose={() => setOpenGoalDialog(false)} />
      )}
    </section>
  );
}

function Progress({ value = 0, loading = false }) {
  const pctText = `${value.toFixed(1)}%`;
  return (
    <div
      className={`wg-bar ${loading ? "is-loading" : ""}`}
      role="progressbar"
      aria-valuenow={Number(value.toFixed(1))}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div className="wg-bar__fill" style={{ width: `${value}%` }}>
        <span className="wg-bar__pct">{pctText}</span>
      </div>
    </div>
  );
}
