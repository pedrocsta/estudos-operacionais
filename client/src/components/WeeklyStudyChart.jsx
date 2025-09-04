import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AngleLeft from "../assets/icons/angle-left.svg";
import AngleRight from "../assets/icons/angle-right.svg";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ===== Helpers de data ===== */
function startOfWeekSunday(d = new Date()) {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = base.getDay(); // 0=Dom..6=Sab
  const start = new Date(base);
  start.setDate(base.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  return start;
}
function endOfWeekSaturday(d = new Date()) {
  const start = startOfWeekSunday(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function rangeLabel(from, to) {
  const fmt = (dd) =>
    dd.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

/* minutos -> 00h00min */
function fmtHoras(min) {
  const m = Math.max(0, Math.floor(Number(min) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}h${String(mm).padStart(2, "0")}min`;
}
/* questões -> 00 questões (sempre plural, conforme pedido) */
function fmtQ(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return `${String(v).padStart(2, "0")} questões`;
}

export default function WeeklyStudyChart({ userId }) {
  const [mode, setMode] = useState("time"); // "time" | "questions"
  const [cursor, setCursor] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(
    Array.from({ length: 7 }, () => ({ min: 0, hit: 0, miss: 0 }))
  );

  const plotRef = useRef(null);
  const tipRef = useRef(null); // tooltip flutuante único

  const from = useMemo(() => startOfWeekSunday(cursor), [cursor]);
  const to = useMemo(() => endOfWeekSaturday(cursor), [cursor]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        userId,
        from: ymd(from),
        to: ymd(to),
        order: "asc",
        limit: "500",
        offset: "0",
      }).toString();
      const res = await fetch(`${API_BASE}/api/studies?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      const byDay = Array.from({ length: 7 }, () => ({ min: 0, hit: 0, miss: 0 }));
      const items = Array.isArray(json.items) ? json.items : [];
      for (const it of items) {
        const d = new Date(it.studyDate);
        const dow = d.getDay();
        byDay[dow].min += Number(it.durationMin) || 0;
        byDay[dow].hit += Number(it.questionsRight) || 0;
        byDay[dow].miss += Number(it.questionsWrong) || 0;
      }
      setData(byDay);
    } catch (e) {
      console.error(e);
      setData(Array.from({ length: 7 }, () => ({ min: 0, hit: 0, miss: 0 })));
    } finally {
      setLoading(false);
    }
  }, [userId, from, to]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onChange = () => load();
    window.addEventListener("study:created", onChange);
    window.addEventListener("study:deleted", onChange);
    window.addEventListener("study:updated", onChange);
    return () => {
      window.removeEventListener("study:created", onChange);
      window.removeEventListener("study:deleted", onChange);
      window.removeEventListener("study:updated", onChange);
    };
  }, [load]);

  const isTime = mode === "time";

  // série: horas (float) OU questões (int)
  const series = useMemo(
    () => (isTime ? data.map((d) => d.min / 60) : data.map((d) => d.hit + d.miss)),
    [isTime, data]
  );

  // topo “sempre acima”
  const maxVal = useMemo(() => {
    const rawMax = Math.max(0, ...series);
    if (isTime) {
      // arredonda para cima no múltiplo de 0.5 e soma +0.5 (ex.: 2.5->3.5; 3.0->4.0)
      const ceil05 = Math.ceil(rawMax * 2) / 2;
      return Math.max(0.5, (ceil05 || 0.5) + 0.5);
    }
    // questões: múltiplo de 5 acima e soma +5 (ex.: 10->20, 15->25, 19->25, 20->30)
    const ceil5 = Math.ceil(rawMax / 5) * 5 || 5;
    return Math.max(5, ceil5 + 5);
  }, [series, isTime]);

  const steps = 5;

  // rótulos do eixo Y (decrescentes: topo -> base)
  const tickVals = useMemo(() => {
    if (isTime) {
      const step = maxVal / (steps - 1);
      return Array.from({ length: steps }, (_, i) => maxVal - i * step);
    } else {
      const top = Math.ceil(maxVal);
      const stepInt = Math.max(1, Math.ceil(top / (steps - 1)));
      return Array.from({ length: steps }, (_, i) => Math.max(0, top - i * stepInt));
    }
  }, [maxVal, isTime]);

  const fmtTick = (v) => (isTime ? v.toFixed(1) : String(Math.round(v)));

  function prevWeek() { const d = new Date(from); d.setDate(d.getDate() - 1); setCursor(d); }
  function nextWeek() { const d = new Date(to);   d.setDate(d.getDate() + 1); setCursor(d); }

  /* ===== Tooltip flutuante ===== */
  function showTip(e, label, valueStr) {
    const plotEl = plotRef.current;
    const tipEl = tipRef.current;
    if (!plotEl || !tipEl) return;

    tipEl.innerHTML = `<span class="wchart__tip-label">${label}</span>
                       <span class="wchart__tip-value">${valueStr}</span>`;

    const rect = plotEl.getBoundingClientRect();
    const tipRect = tipEl.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const offset = 12;
    let left = relX + offset;
    let top = relY + offset;

    const maxLeft = rect.width - tipRect.width - 4;
    const maxTop = rect.height - tipRect.height - 4;
    left = Math.max(4, Math.min(left, maxLeft));
    top = Math.max(4, Math.min(top, maxTop));

    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
    tipEl.style.opacity = "1";
    tipEl.style.visibility = "visible";
  }
  function hideTip() {
    const tipEl = tipRef.current;
    if (!tipEl) return;
    tipEl.style.opacity = "0";
    tipEl.style.visibility = "hidden";
  }

  return (
    <section className="wchart">
      <header className="wchart__head">
        <h4 className="card-title">Estudos Semanal</h4>
        <div className="wchart__nav">
          <button className="btn-svg btn-outline wchart__arrow" onClick={prevWeek} title="Semana anterior" aria-label="Semana anterior">
            <img src={AngleLeft} alt="" aria-hidden="true" width="16" height="16" />
          </button>
          <div className="wchart__range">{rangeLabel(from, to)}</div>
          <button className="btn-svg btn-outline wchart__arrow" onClick={nextWeek} title="Próxima semana" aria-label="Próxima semana">
            <img src={AngleRight} alt="" aria-hidden="true" width="16" height="16" />
          </button>
        </div>
      </header>

      <div className="wchart__layout">
        {/* Plot */}
        <div className="wchart__plot" ref={plotRef}>
          {/* grid + ticks */}
          <div className="wchart__grid">
            {tickVals.map((t, i) => {
              const topPct = (i / (steps - 1)) * 100; // posição visual (topo → base)
              return (
                <div key={i} className="wchart__gridline" style={{ top: `${topPct}%` }}>
                  <span className="wchart__tick">{fmtTick(t)}</span>
                </div>
              );
            })}
          </div>

          {/* barras */}
          <div className={`wchart__bars ${loading ? "is-loading" : ""}`}>
            {data.map((d, i) => {
              if (isTime) {
                const hours = d.min / 60;
                const hPct = Math.min(100, (hours / maxVal) * 100);
                return (
                  <div
                    key={i}
                    className="wchart__bar"
                    onMouseMove={(e) => (d.min > 0 ? showTip(e, "Tempo:", fmtHoras(d.min)) : hideTip())}
                    onMouseEnter={(e) => (d.min > 0 ? showTip(e, "Tempo:", fmtHoras(d.min)) : hideTip())}
                    onMouseLeave={hideTip}
                  >
                    <div
                      className="wchart__bar-fill"
                      style={{ height: `${hPct}%`, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
                    />
                  </div>
                );
              } else {
                const total = d.hit + d.miss;
                const totPct = Math.min(100, (total / maxVal) * 100);
                const missPct = total ? (d.miss / total) * totPct : 0;
                const hitPct = Math.max(0, totPct - missPct);
                return (
                  <div key={i} className="wchart__bar" onMouseLeave={hideTip}>
                    <div
                      className="wchart__bar-fill hits"
                      style={{ height: `${hitPct}%` }}
                      onMouseMove={(e) => (d.hit > 0 ? showTip(e, "Acertos:", fmtQ(d.hit)) : hideTip())}
                      onMouseEnter={(e) => (d.hit > 0 ? showTip(e, "Acertos:", fmtQ(d.hit)) : hideTip())}
                    />
                    <div
                      className="wchart__bar-fill miss"
                      style={{ height: `${missPct}%` }}
                      onMouseMove={(e) => (d.miss > 0 ? showTip(e, "Erros:", fmtQ(d.miss)) : hideTip())}
                      onMouseEnter={(e) => (d.miss > 0 ? showTip(e, "Erros:", fmtQ(d.miss)) : hideTip())}
                    />
                  </div>
                );
              }
            })}
          </div>

          {/* eixo X */}
          <div className="wchart__x">
            {["DOM","SEG","TER","QUA","QUI","SEX","SAB"].map((d) => (
              <div key={d} className="wchart__xitem">{d}</div>
            ))}
          </div>

          {/* Tooltip flutuante único */}
          <div ref={tipRef} className="wchart__tooltip" />
        </div>

        {/* Controles */}
        <div className="wchart__controls">
          <button
            className={`wchart__mode ${mode === "time" ? "is-active" : ""}`}
            onClick={() => setMode("time")}
          >
            TEMPO
          </button>
          <button
            className={`wchart__mode ${mode === "questions" ? "is-active" : ""}`}
            onClick={() => setMode("questions")}
          >
            QUESTÕES
          </button>
        </div>
      </div>
    </section>
  );
}
