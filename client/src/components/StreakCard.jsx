import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const MIN_CELL = 46;
const API_BASE = import.meta.env.VITE_API_URL || "";

// normaliza Date local -> "YYYY-MM-DD" (chave do mapa)
function ymdUTCFromLocalDate(localDate) {
  const d = new Date(
    Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate())
  );
  return d.toISOString().slice(0, 10);
}

export default function StreakCard() {
  const { user } = useAuth();
  const userId = user?.id;

  const barRef = useRef(null);
  const [cols, setCols] = useState(1);
  const [days, setDays] = useState([]); // [{ data: "DD/MM/AAAA", estudou: boolean }]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // -------- layout responsivo
  useEffect(() => {
    function recalc() {
      const el = barRef.current;
      if (!el) return;
      const width = el.clientWidth || 0;
      const next = Math.max(1, Math.floor(width / MIN_CELL));
      setCols(next);
    }
    recalc();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(recalc);
      if (barRef.current) ro.observe(barRef.current);
    }
    window.addEventListener("resize", recalc);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  // -------- fetch dos dias (função reutilizável)
  const fetchDays = React.useCallback(async (signal) => {
    if (!userId) return;
    try {
      setLoading(true);
      setErr("");
      const res = await fetch(
        `${API_BASE}/api/studies/days?userId=${encodeURIComponent(userId)}`,
        { signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDays(data.estudos || []);
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error(e);
      setErr("Não consegui carregar os dados de estudo.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // carga inicial e quando trocar userId
  useEffect(() => {
    if (!userId) return;
    const ctrl = new AbortController();
    fetchDays(ctrl.signal);
    return () => ctrl.abort();
  }, [userId, fetchDays]);

  // -------- “tempo real”: ouve eventos e refaz o fetch
  useEffect(() => {
    function onStudyChanged() {
      // refaz o fetch (sem AbortController aqui porque é rápido)
      fetchDays();
    }
    window.addEventListener("study:created", onStudyChanged);
    window.addEventListener("study:deleted", onStudyChanged);
    window.addEventListener("study:updated", onStudyChanged);

    return () => {
      window.removeEventListener("study:created", onStudyChanged);
      window.removeEventListener("study:deleted", onStudyChanged);
      window.removeEventListener("study:updated", onStudyChanged);
    };
  }, [fetchDays]);

  // mapa YYYY-MM-DD -> estudou:boolean a partir do array "DD/MM/AAAA"
  const daysMap = useMemo(() => {
    const map = new Map();
    for (const d of days) {
      const [dia, mes, ano] = String(d.data).split("/");
      if (dia && mes && ano) {
        const key = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
        map.set(key, !!d.estudou);
      }
    }
    return map;
  }, [days]);

  // streak atual: array já vem de hoje pra trás
  const streakDays = useMemo(() => {
    let s = 0;
    for (const d of days) {
      if (d.estudou) s++;
      else break;
    }
    return s;
  }, [days]);

  const cells = useMemo(() => Array.from({ length: cols }), [cols]);

  return (
    <section className="card bare" data-area="streak">
      <h3 className="card-title">Constância nos estudos</h3>

      <p className="text-sm mb-2 streak-text">
        Você está há <b>{streakDays} dia(s)</b> sem falhar!
      </p>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div
        className="streak-bar"
        ref={barRef}
        aria-busy={loading ? "true" : "false"}
      >
        <div className="streak-row" style={{ "--cols": String(cols) }}>
          {cells.map((_, i) => {
            const caret = i === 0 ? <div className="streak-caret" /> : null;

            const date = new Date();
            date.setDate(date.getDate() - i);
            const label = date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });
            const ymd = ymdUTCFromLocalDate(date);

            let status;
            if (daysMap.has(ymd)) {
              status = daysMap.get(ymd) ? "ok" : "fail";
            } else {
              status = "past";
            }

            const symbol = status === "ok" ? "✓" : status === "fail" ? "✕" : "";

            return (
              <div
                key={i}
                className={`streak-cell ${status}`}
                title={label}
              >
                {caret}
                {symbol && <span className="ico">{symbol}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
