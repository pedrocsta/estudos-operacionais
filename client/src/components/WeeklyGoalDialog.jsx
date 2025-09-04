import React, { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function WeeklyGoalDialog({ userId, onClose }) {
  const panelRef = useRef(null);
  const [hours, setHours] = useState(0);        // em HORAS (UI)
  const [questions, setQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // carregar metas atuais (0 por padrão se não tiver)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) return;
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`${API_BASE}/api/goals/weekly-setting?userId=${encodeURIComponent(userId)}`);
        // se a rota ainda não existir, trate como 0/0
        if (!res.ok) throw new Error("noop");
        const data = await res.json().catch(() => ({}));
        const hoursMin = Number(data?.hoursTargetMin) || 0;
        const qTarget = Number(data?.questionsTarget) || 0;
        if (!cancelled) {
          setHours(Math.floor(hoursMin / 60));
          setQuestions(qTarget);
        }
      } catch {
        if (!cancelled) {
          setHours(0);
          setQuestions(0);
        }
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function clampInt(n, min=0, max=100000) {
    const v = Math.floor(Number(n) || 0);
    return Math.max(min, Math.min(max, v));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!userId) return;

    const hoursTargetMin = clampInt(hours, 0, 1000) * 60; // salva em MINUTOS
    const questionsTarget = clampInt(questions, 0, 100000);

    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/goals/weekly-setting`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, hoursTargetMin, questionsTarget }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      // avisa a UI (WeeklyGoals) para se atualizar
      window.dispatchEvent(new CustomEvent("goals:updated", { detail: data }));
      onClose?.();
    } catch (e2) {
      console.error(e2);
      setErr("Não foi possível salvar sua meta agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rs-overlay" role="dialog" aria-modal="true">
      <div
        className="rs-dialog-matter"
        ref={panelRef}
        aria-labelledby="wg-title"
        onClick={(ev) => ev.stopPropagation()}
        style={{ width: "min(520px, 96vw)" }}
      >
        <div className="rs-header">
          <h3 id="wg-title">Definir Meta</h3>
          <button className="rs-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <form className="rs-body" onSubmit={onSubmit}>
          {/* Horas por semana */}
          <label className="rs-label" style={{ marginTop: 8 }}>
            Quantas horas, em média, pretende estudar <b>por semana</b>?
          </label>
          <div className="rs-counter" style={{ marginTop: 6 }}>
            <input
              className="rs-counter__input"
              type="number"
              min="0"
              inputMode="numeric"
              value={hours}
              onChange={(e) => setHours(clampInt(e.target.value))}
              disabled={loading || saving}
              aria-label="Horas por semana"
            />
            <div className="rs-counter__btns">
              <button type="button" onClick={() => setHours((v) => Math.max(0, v - 1))} disabled={loading || saving || hours <= 0}>−</button>
              <button type="button" onClick={() => setHours((v) => v + 1)} disabled={loading || saving}>+</button>
            </div>
          </div>

          {/* Questões por semana */}
          <label className="rs-label" style={{ marginTop: 16 }}>
            Quantas questões, em média, pretende resolver <b>por semana</b>?
          </label>
          <div className="rs-counter" style={{ marginTop: 6 }}>
            <input
              className="rs-counter__input"
              type="number"
              min="0"
              inputMode="numeric"
              value={questions}
              onChange={(e) => setQuestions(clampInt(e.target.value))}
              disabled={loading || saving}
              aria-label="Questões por semana"
            />
            <div className="rs-counter__btns">
              <button type="button" onClick={() => setQuestions((v) => Math.max(0, v - 1))} disabled={loading || saving || questions <= 0}>−</button>
              <button type="button" onClick={() => setQuestions((v) => v + 1)} disabled={loading || saving}>+</button>
            </div>
          </div>

          {!!err && <div className="toast-error" style={{ marginTop: 12 }}>{err}</div>}

          <div className="rs-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="rs-btn btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="rs-btn btn btn-solid" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
