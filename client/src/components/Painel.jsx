import React, { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* util: minutos -> "HHhMMmin" (com zero à esquerda) */
function fmtHoras(min) {
  const n = Number(min) || 0;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}min`;
}

export default function Painel({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSubjects, setHasSubjects] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const ctrl = new AbortController();
    try {
      setLoading(true);

      // pega TODAS as disciplinas do usuário
      const subjRes = await fetch(
        `${API_BASE}/api/subjects?userId=${encodeURIComponent(userId)}`,
        { signal: ctrl.signal }
      );
      const subjects = (await subjRes.json().catch(() => [])) || [];
      setHasSubjects(Array.isArray(subjects) && subjects.length > 0);

      // mapa base com todas as matérias zeradas
      const bySubject = new Map();
      for (const s of subjects) {
        bySubject.set(s.id, {
          subjectId: s.id,
          subject: s.name || "—",
          totalMin: 0,
          hits: 0,
          mistakes: 0,
        });
      }

      // busca estudos
      const qs = new URLSearchParams({
        userId,
        order: "desc",
        limit: "200",
        offset: "0",
      }).toString();
      const res = await fetch(`${API_BASE}/api/studies?${qs}`, { signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const items = Array.isArray(data.items) ? data.items : [];

      // soma por disciplina
      for (const it of items) {
        const sid = it.subject?.id || it.subjectId;
        if (!sid) continue;

        if (!bySubject.has(sid)) {
          bySubject.set(sid, {
            subjectId: sid,
            subject: it.subject?.name || "—",
            totalMin: 0,
            hits: 0,
            mistakes: 0,
          });
        }
        const row = bySubject.get(sid);
        row.totalMin += Number(it.durationMin) || 0;
        row.hits += Number(it.questionsRight) || 0;
        row.mistakes += Number(it.questionsWrong) || 0;
      }

      const list = Array.from(bySubject.values())
        .map((r) => {
          const total = r.hits + r.mistakes;
          const pct = total > 0 ? Math.floor((r.hits * 100) / total) : 0;
          return { ...r, total, pct };
        })
        .sort((a, b) => a.subject.localeCompare(b.subject));

      setRows(list);
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error(e);
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [userId]);

  // carga inicial
  useEffect(() => { load(); }, [load]);

  // ouvir eventos globais
  useEffect(() => {
    const onChange = () => load();
    window.addEventListener("study:created", onChange);
    window.addEventListener("study:deleted", onChange);
    window.addEventListener("study:updated", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("study:created", onChange);
      window.removeEventListener("study:deleted", onChange);
      window.removeEventListener("study:updated", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [load]);

  if (!userId) return null;
  if (loading) return <p className="text-sm" style={{ opacity: 0.8 }}>Carregando…</p>;
  if (!rows.length) {
    return (
      <p className="text-sm" style={{ opacity: 0.8 }}>
        {hasSubjects ? "Sem dados ainda." : "Nenhuma disciplina cadastrada."}
      </p>
    );
  }

  return (
    <div className="painel">
      <div className="painel__table">
        {/* cabeçalho */}
        <div className="painel__row painel__row--head">
          <div className="col col--disc">Disciplinas</div>
          <div className="col col--tempo col--sep">Tempo</div>
          <div className="col col--ok">✔</div>
          <div className="col col--err">✕</div>
          <div className="col col--sum">∑</div>
          <div className="col col--pct">%</div>
        </div>

        {/* linhas */}
        {rows.map((r, i) => (
          <div
            key={r.subjectId || r.subject + i}
            className={`painel__row ${i % 2 ? "is-odd" : "is-even"}`}
          >
            <div className="col col--disc">{r.subject}</div>
            <div className="col col--tempo col--sep">
              {r.totalMin > 0 ? fmtHoras(r.totalMin) : "-"}
            </div>
            <div className="col col--ok">{r.hits}</div>
            <div className="col col--err">{r.mistakes}</div>
            <div className="col col--sum">{r.total}</div>
            <div className="col col--pct">
              <PctBadge value={r.pct} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Badge de % com cores conforme faixas */
function PctBadge({ value = 0 }) {
  let bg = "#F5F2E8", fg = "#000000";
  if (value > 0 && value < 65) { bg = "#C96C67"; fg = "#FFFFFF"; }
  else if (value >= 65 && value < 75) { bg = "#E2C76D"; fg = "#000000"; }
  else if (value >= 75) { bg = "#7BA77A"; fg = "#FFFFFF"; }
  return (
    <span className="pct-badge" style={{ background: bg, color: fg }}>
      {value}
    </span>
  );
}
