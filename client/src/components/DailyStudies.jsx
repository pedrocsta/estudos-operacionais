import React, { useCallback, useEffect, useRef, useState } from "react";
import AngleLeft from "../assets/angle-left.svg";
import AngleRight from "../assets/angle-right.svg";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ==== Utils ==== */
function ymd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fmtDateLabel(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtHHhMMmin(totalMin) {
  const n = Number(totalMin) || 0;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}min`;
}
/* Fallback determinístico de cor (se backend não trouxer subject.color) */
function colorFromString(str) {
  const s = String(str || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 60%, 60%)`;
}

export default function DailyStudies({ userId }) {
  const [cursor, setCursor] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const chartRef = useRef(null);
  const tipRef = useRef(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        userId,
        from: ymd(cursor),
        to: ymd(cursor),
        order: "asc",
        limit: "200",
        offset: "0",
      }).toString();
      const res = await fetch(`${API_BASE}/api/studies?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      const items = Array.isArray(json.items) ? json.items : [];
      const bySubject = new Map();

      for (const it of items) {
        const sid = it.subject?.id || it.subjectId;
        if (!sid) continue;
        if (!bySubject.has(sid)) {
          bySubject.set(sid, {
            subjectId: sid,
            subject: it.subject?.name || "—",
            color: it.subject?.color || null,
            totalMin: 0,
          });
        }
        const row = bySubject.get(sid);
        row.totalMin += Number(it.durationMin) || 0;
        if (!row.color && it.subject?.color) row.color = it.subject.color;
      }

      setRows(Array.from(bySubject.values()));
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId, cursor]);

  useEffect(() => { load(); }, [load]);

  const totalMin = rows.reduce((acc, r) => acc + r.totalMin, 0);

  function prevDay() {
    const d = new Date(cursor);
    d.setDate(d.getDate() - 1);
    setCursor(d);
  }
  function nextDay() {
    const d = new Date(cursor);
    d.setDate(d.getDate() + 1);
    setCursor(d);
  }

  /* ===== Tooltip flutuante (mesmo estilo do wchart__tooltip) ===== */
  function showTip(e, text) {
    const plotEl = chartRef.current;
    const tipEl = tipRef.current;
    if (!plotEl || !tipEl) return;

    tipEl.innerHTML = `<span class="wchart__tip-value">${text}</span>`;

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
    <section className="daily">
      <header className="daily__head">
        <h4 className="card-title">ESTUDOS DO DIA</h4>
        <div className="daily__nav">
          <button className="btn-svg btn-outline daily__arrow" onClick={prevDay}>
            <img src={AngleLeft} alt="" width="16" height="16" />
          </button>
          <div className="daily__range">{fmtDateLabel(cursor)}</div>
          <button className="btn-svg btn-outline daily__arrow" onClick={nextDay}>
            <img src={AngleRight} alt="" width="16" height="16" />
          </button>
        </div>
      </header>

      <div className="daily__layout">
        {/* Donut Chart */}
        <div className="daily__chart" ref={chartRef}>
          <svg viewBox="0 0 36 36" className="donut">
            <circle className="donut-bg" cx="18" cy="18" r="15.915" />
            {rows.length > 0 ? (() => {
              let offset = 25;         // começa no topo
              let used = 0;            // soma acumulada (para fechar o círculo sem buracos por arredondamento)
              const n = rows.length;
              return rows.map((r, i) => {
                const share = totalMin > 0 ? (r.totalMin / totalMin) * 100 : 0;
                let dash = i < n - 1 ? +share.toFixed(3) : Math.max(0, 100 - used);
                used += dash;

                const strokeColor = r.color || colorFromString(r.subjectId || r.subject || i);

                const el = (
                  <circle
                    key={i}
                    className="donut-seg"
                    cx="18"
                    cy="18"
                    r="15.915"
                    strokeDasharray={`${dash} ${100 - dash}`}
                    strokeDashoffset={offset}
                    style={{ stroke: strokeColor, strokeLinecap: "butt" }}
                    onMouseEnter={(e) => showTip(e, r.subject)}
                    onMouseMove={(e) => showTip(e, r.subject)}
                    onMouseLeave={hideTip}
                  />
                );
                offset = (offset - dash + 100) % 100;
                return el;
              });
            })() : null}
          </svg>

          <div className="donut-center">{fmtHHhMMmin(totalMin)}</div>
          {/* Tooltip (reutiliza o mesmo CSS do WeeklyStudyChart) */}
          <div ref={tipRef} className="wchart__tooltip" />
        </div>

        {/* Lista de matérias */}
        <div className="daily__list">
          {loading && <p style={{ opacity: 0.8 }}>Carregando…</p>}
          {!loading && rows.length === 0 && (
            <p style={{ opacity: 0.8, fontSize: 14, textAlign: "center", margin: 0 }}>
              Nenhum estudo registrado ainda.
            </p>
          )}
          {rows.map((r, i) => (
            <div key={r.subjectId || i} className="daily__item">
              <span
                className="daily__dot"
                style={{ background: r.color || colorFromString(r.subjectId || r.subject || i) }}
              />
              <span className="daily__subj">{r.subject}</span>
              <span className="ds-line" />
              <span className="daily__time">{fmtHHhMMmin(r.totalMin)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
