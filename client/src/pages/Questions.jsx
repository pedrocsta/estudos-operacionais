import React, { useEffect, useMemo, useRef, useState } from "react";
import "../questions.css";

import AngleRight from "../assets/icons/angle-right.svg";
import AngleDown from "../assets/icons/angle-down.svg";

const API = import.meta.env.VITE_API_URL || "";

/** Converte "->" em " → " (com espaçamento bonito) */
const arrowify = (s) =>
  typeof s === "string" ? s.replace(/\s*->\s*/g, " → ") : s;

/** Util: fecha dropdown ao clicar fora */
function useClickAway(ref, onAway) {
  useEffect(() => {
    function fn(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onAway?.();
    }
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onAway, ref]);
}

/** Disciplina como dropdown com checkbox + busca (single-select) */
function CheckboxDropdown({
  placeholder = "Selecionar…",
  options = [],
  value = "",
  onChange,
  label = "Disciplina",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  useClickAway(rootRef, () => setOpen(false));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(val) {
    // seleção única (checkbox só pela estética)
    if (value === val) onChange?.("");
    else onChange?.(val);
    setOpen(false);
  }

  return (
    <div className="dd" ref={rootRef}>
      <button
        type="button"
        className={`dd__btn ${value ? "dd__btn--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={label}
      >
        <span className="dd__btn-label">{value || placeholder}</span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div className="dd__menu">
          <div className="dd__search">
            <input
              type="text"
              placeholder="Digite para filtrar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {!!value && (
              <button
                type="button"
                className="dd__clear"
                onClick={() => onChange?.("")}
                title="Limpar seleção"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="dd__list" role="listbox" aria-label={label}>
            {filtered.length === 0 && (
              <div className="dd__empty">Nenhuma opção</div>
            )}
            {filtered.map((opt) => {
              const checked = value === opt;
              return (
                <label key={opt} className="dd__item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt)}
                  />
                  <span className="dd__item-text">{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Questions() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 1 por página
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // filtros
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [board, setBoard] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [year, setYear] = useState("");

  // seleção da alternativa (por questão)
  const [selectedMap, setSelectedMap] = useState({});

  // resultado por questão
  // { [q-<id>]: { status: 'correct'|'wrong'|'error', correctLetter?: string, message?: string } }
  const [resultMap, setResultMap] = useState({});

  // controle de envio por questão
  // { [q-<id>]: boolean }
  const [submitting, setSubmitting] = useState({});

  // carregar metadados
  useEffect(() => {
    fetch(`${API}/api/questions/meta`)
      .then((r) => {
        if (!r.ok) throw new Error("Erro ao carregar metadados");
        return r.json();
      })
      .then(setMeta)
      .catch((e) => console.error(e));
  }, []);

  // limpar tópico ao trocar disciplina
  useEffect(() => {
    setTopic("");
  }, [subject]);

  // tópicos por disciplina
  const topicsForSubject = useMemo(() => {
    if (!subject) return [];
    if (meta?.topicsBySubject?.[subject]) return meta.topicsBySubject[subject];
    return meta?.topics || [];
  }, [meta, subject]);

  // query string dos filtros
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (subject) p.set("subject", subject);
    if (board) p.set("board", board);
    if (topic) p.set("topic", topic);
    if (level) p.set("level", level);
    if (year) p.set("year", year);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [search, subject, board, topic, level, year, page, pageSize]);

  // carregar questões
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/questions?${qs}`)
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) throw new Error(text);
        try {
          return JSON.parse(text);
        } catch {
          throw new Error("Resposta não é JSON: " + text.slice(0, 200));
        }
      })
      .then((data) => {
        const withFlags = (data.items || []).map((it) => ({
          ...it,
          showComment: it.showComment ?? false,
        }));
        setItems(withFlags);
        setTotal(data.total || 0);
        // ao trocar de página/filtros, limpa seleções e resultados
        setSelectedMap({});
        setResultMap({});
        setSubmitting({});
      })
      .catch((e) => setError(e.message || "Erro"))
      .finally(() => setLoading(false));
  }, [qs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleComment(id) {
    setItems((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, showComment: !x.showComment } : x
      )
    );
  }

  async function handleSubmit(q) {
    const key = `q-${q.id}`;
    const chosen = selectedMap[key];
    if (!chosen) return;

    setSubmitting((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await fetch(`${API}/api/questions/${q.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter: chosen }),
      });

      if (res.ok) {
        // esperado: { correct: boolean, correctLetter?: string, message?: string }
        const data = await res.json().catch(() => ({}));
        const correct = !!data.correct;
        const correctLetter = data.correctLetter ?? q.correctLetter;

        setResultMap((prev) => ({
          ...prev,
          [key]: {
            status: correct ? "correct" : "wrong",
            correctLetter,
            message: data.message,
          },
        }));
      } else {
        // fallback local
        if (q.correctLetter) {
          const correct = chosen === q.correctLetter;
          setResultMap((prev) => ({
            ...prev,
            [key]: {
              status: correct ? "correct" : "wrong",
              correctLetter: q.correctLetter,
              message:
                "Não foi possível confirmar com o servidor; resultado verificado localmente.",
            },
          }));
        } else {
          setResultMap((prev) => ({
            ...prev,
            [key]: { status: "error", message: "Erro ao enviar resposta." },
          }));
        }
      }
    } catch (e) {
      if (q.correctLetter) {
        const correct = selectedMap[key] === q.correctLetter;
        setResultMap((prev) => ({
          ...prev,
          [key]: {
            status: correct ? "correct" : "wrong",
            correctLetter: q.correctLetter,
            message:
              "Sem conexão com o servidor; resultado verificado localmente.",
          },
        }));
      } else {
        setResultMap((prev) => ({
          ...prev,
          [key]: { status: "error", message: "Falha de rede ao enviar resposta." },
        }));
      }
    } finally {
      setSubmitting((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="page">
      <h1>Questões</h1>

      {/* filtros */}
      <div className="filters">
        <input
          className="inp"
          placeholder="Buscar no enunciado/texto de apoio…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />

        <CheckboxDropdown
          label="Disciplina"
          placeholder="Disciplina"
          options={meta?.subjects || []}
          value={subject}
          onChange={(v) => {
            setPage(1);
            setSubject(v);
          }}
        />

        <select
          className="sel"
          value={board}
          onChange={(e) => {
            setPage(1);
            setBoard(e.target.value);
          }}
        >
          <option value="">Banca</option>
          {meta?.boards?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="sel"
          value={topic}
          onChange={(e) => {
            setPage(1);
            setTopic(e.target.value);
          }}
          disabled={!subject}
          title={!subject ? "Selecione uma Disciplina primeiro" : "Tópico"}
        >
          <option value="">
            {subject ? "Tópico" : "Selecione uma Disciplina…"}
          </option>
          {topicsForSubject?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="sel"
          value={level}
          onChange={(e) => {
            setPage(1);
            setLevel(e.target.value);
          }}
        >
          <option value="">Nível</option>
          {meta?.levels?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="sel"
          value={year}
          onChange={(e) => {
            setPage(1);
            setYear(e.target.value);
          }}
        >
          <option value="">Ano</option>
          {meta?.years?.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* paginação */}
      <div className="pager">
        <span>Total: {total}</span>
        <span className="pager__spacer" />
        <span>
          Página {page} de {totalPages}
        </span>
        <button
          className="btn"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <button
          className="btn"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>

      {loading && <p>Carregando…</p>}
      {error && <p className="err">{error}</p>}

      {/* lista de questões */}
      <ul className="q-list">
        {items.map((q) => {
          const groupName = `q-${q.id}`;
          const result = resultMap[groupName];
          const isAnswered = !!result && result.status !== "error";

          return (
            <li key={q.id} className="q-wrap">
              {/* 1) HEADER */}
              <div className="q-part q-part--head">
                <strong>Q{q.id}</strong>
                {(q.subtopico_caminho || q.topic) && (
                  <span className="q-subtopic">
                    {" "}
                    {arrowify(q.subtopico_caminho) || q.topic}
                  </span>
                )}
              </div>

              {/* 2) META */}
              <div className="q-part q-part--meta">
                <span>
                  <strong>Banca:</strong> {q.board || "—"}
                </span>
                <span>
                  <strong>Ano:</strong> {q.year || "—"}
                </span>
                <span>
                  <strong>Nível:</strong> {q.level || "—"}
                </span>
              </div>

              {/* 3) QUESTÃO */}
              <div className="q-part q-part--body">
                {q.supportText && (
                  <details className="q-details">
                    <summary>Texto de apoio</summary>
                    <div className="q-pre">{q.supportText}</div>
                  </details>
                )}

                {q.statement && <p className="q-statement">{q.statement}</p>}

                {!!q.alternatives?.length && (
                  <div className="q-alt">
                    {q.alternatives.map((a, i) => {
                      const letter = a.letter || String.fromCharCode(65 + i);
                      const selected = selectedMap[groupName] === letter;

                      // pós-envio
                      const isCorrectLetter =
                        isAnswered &&
                        result?.correctLetter &&
                        letter === result.correctLetter;
                      const isWrongChosen =
                        isAnswered && selected && !isCorrectLetter;

                      return (
                        <label
                          key={i}
                          className={`q-opt ${selected ? "is-selected" : ""} ${
                            isCorrectLetter ? "is-right" : ""
                          } ${isWrongChosen ? "is-wrong" : ""}`}
                          htmlFor={`${groupName}-${letter}`}
                        >
                          <input
                            id={`${groupName}-${letter}`}
                            type="radio"
                            name={groupName}
                            value={letter}
                            checked={selected}
                            className="q-opt__radio"
                            onClick={(e) => {
                              if (selected) {
                                e.preventDefault();
                                setSelectedMap((prev) => {
                                  const next = { ...prev };
                                  delete next[groupName];
                                  return next;
                                });
                                setResultMap((prev) => {
                                  const next = { ...prev };
                                  delete next[groupName];
                                  return next;
                                });
                              }
                            }}
                            onChange={() => {
                              if (!selected) {
                                setSelectedMap((prev) => ({
                                  ...prev,
                                  [groupName]: letter,
                                }));
                                setResultMap((prev) => {
                                  const next = { ...prev };
                                  delete next[groupName];
                                  return next;
                                });
                              }
                            }}
                            disabled={isAnswered}
                          />
                          <span className="q-opt__letter">{letter}</span>
                          <span className="q-opt__text">{a.text}</span>
                        </label>
                      );
                    })}

                    {/* Botão + Resultado lado a lado */}
                    <div className="q-actions">
                      <button
                        type="button"
                        className={`q-submit ${result ? "is-locked" : ""}`}
                        onClick={() => handleSubmit(q)}
                        disabled={!selectedMap[groupName] || submitting[groupName] || !!result}
                        title={
                          result
                            ? "Resposta já enviada"
                            : !selectedMap[groupName]
                            ? "Selecione uma alternativa"
                            : "Enviar resposta"
                        }
                      >
                        {submitting[groupName] ? "ENVIANDO..." : "RESPONDER"}
                      </button>

                      {result ? (
                        <div
                          className={`q-result ${
                            result.status === "correct"
                              ? "is-correct"
                              : result.status === "wrong"
                              ? "is-wrong"
                              : "is-error"
                          }`}
                          role="status"
                          aria-live="polite"
                        >
                          <div className="q-result__title">
                            {result.status === "correct"
                              ? "PARABÉNS!"
                              : result.status === "wrong"
                              ? "ERROU"
                              : "OPS…"}
                          </div>

                          <div className="q-result__sub">
                            {result.status === "correct" && "Você acertou!"}
                            {result.status === "wrong" &&
                              (result.correctLetter
                                ? `Resposta correta: ${result.correctLetter}`
                                : "Resposta incorreta.")}
                            {result.status === "error" &&
                              (result.message ||
                                "Não foi possível verificar agora.")}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="q-result q-result--placeholder"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 4) COMENTÁRIO */}
              <div className="q-part q-part--foot">
                <button
                  className={`q-comment-toggle ${
                    q.showComment ? "is-open" : ""
                  }`}
                  onClick={() => toggleComment(q.id)}
                  type="button"
                >
                  Comentário do Professor
                </button>

                {q.showComment && (
                  <div className="q-answer">
                    <p>
                      <strong>Gabarito:</strong> {q.correctLetter ?? "—"}
                    </p>
                    {q.commentText && (
                      <p className="q-pre">{q.commentText}</p>
                    )}
                    {!q.commentText && q.commentHtml && (
                      <div
                        dangerouslySetInnerHTML={{ __html: q.commentHtml }}
                      />
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
