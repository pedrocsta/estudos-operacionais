import React, { useEffect, useMemo, useRef, useState } from "react";

const MIN_CELL = 46;

// Mock de status (se faltar, assume "future")
const MOCK_STATUS = [
  "ok", "ok", "fail", "ok", "ok",
  "fail", "ok", "ok", "ok", "fail",
  "ok"
];

export default function StreakCard() {
  const barRef = useRef(null);
  const [cols, setCols] = useState(1);

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

  const cells = useMemo(() => Array.from({ length: cols }), [cols]);

  return (
    <section className="card bare" data-area="streak">
      <h3 className="card-title">Constância nos estudos</h3>

      <div className="streak-bar" ref={barRef}>
        <div className="streak-row" style={{ "--cols": String(cols) }}>
          {cells.map((_, i) => {
            const caret = i === 0 ? <div className="streak-caret" /> : null;

            // hoje é i=0, ontem i=1, etc.
            const date = new Date();
            date.setDate(date.getDate() - i);
            const label = date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });

            const status = MOCK_STATUS[i] || "future";
            const symbol =
              status === "ok" ? "✓" : status === "fail" ? "✕" : "";

            return (
              <div
                key={i}
                className={`streak-cell ${status}`}
                title={label} // <-- apenas a data aqui
              >
                {caret}
                <span className="ico">{symbol}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
