import React, { useEffect, useRef, useState } from "react";
import RSComboBox from "./RSComboBox";
import SubjectDialog from "./SubjectDialog";

const API_BASE = import.meta.env.VITE_API_URL || ""; // "" => mesmo host (proxy)

export default function AddStudyDialog({ onClose, userId, initialDuration = "00:00:00" }) {
  const panelRef = useRef(null);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);

  // ----------------- datas em HORÁRIO LOCAL -----------------
  function ymdLocal(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const todayISO = ymdLocal(new Date());

  // ----------------- formulário -----------------
  const [selectedDay, setSelectedDay] = useState("today");
  const [customDate, setCustomDate] = useState(todayISO);

  const [form, setForm] = useState({
    category: "",
    subject: "", // subjectId
    duration: "00:00:00",
    content: "",
    questionsRight: 0,
    questionsWrong: 0,
    pageStart: 0,
    pageEnd: 0,
    comment: "",
  });

  // 👉 sincroniza o tempo vindo do cronômetro
  useEffect(() => {
    // garante string HH:MM:SS para o <input type="time">
    const v = String(initialDuration || "00:00:00");
    setForm((f) => ({ ...f, duration: v }));
  }, [initialDuration]);

  function setField(name, value) { setForm((f) => ({ ...f, [name]: value })); }
  function inc(name) { setForm((f) => ({ ...f, [name]: (Number(f[name]) || 0) + 1 })); }
  function dec(name) { setForm((f) => ({ ...f, [name]: Math.max(0, (Number(f[name]) || 0) - 1) })); }

  // HH:MM:SS -> minutos inteiros
  function hhmmssToMinutes(hmsStr) {
    const [h = "0", m = "0", s = "0"] = String(hmsStr || "0:0:0").split(":");
    const total = (+h) * 60 + (+m) + Math.floor((+s) / 60);
    return Number.isFinite(total) ? total : 0;
  }

  async function onSubmit(e) {
    e.preventDefault();

    // usa horário local p/ hoje/ontem
    let studyDate;
    if (selectedDay === "today") {
      studyDate = todayISO;
    } else if (selectedDay === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      studyDate = ymdLocal(d);
    } else {
      studyDate = customDate; // input date já vem YYYY-MM-DD local
    }

    // validações mínimas
    if (!userId) return alert("Sessão inválida.");
    if (!form.subject) return alert("Selecione uma disciplina.");
    if (!form.category) return alert("Selecione uma categoria.");

    const body = {
      userId,
      studyDate,                 // YYYY-MM-DD (local)
      color: "#66F081",          // você pode pegar da subject se quiser
      category: form.category,
      subjectId: form.subject,
      durationMin: hhmmssToMinutes(form.duration),
      content: form.content,
      questionsRight: Number(form.questionsRight) || 0,
      questionsWrong: Number(form.questionsWrong) || 0,
      pageStart: form.pageStart ? Number(form.pageStart) : null,
      pageEnd: form.pageEnd ? Number(form.pageEnd) : null,
      comment: form.comment || "",
    };

    try {
      const resp = await fetch(`${API_BASE}/api/studies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = data?.error || data?.message || `Erro ao salvar (HTTP ${resp.status}).`;
        alert(msg);
        return;
      }

      // avisa o app inteiro que há novo estudo
      window.dispatchEvent(new CustomEvent("study:created", { detail: data }));

      onClose();
    } catch (err) {
      console.error("POST /api/studies failed:", err);
      alert("Falha de comunicação com o servidor.");
    }
  }

  const categoryOptions = [
    { value: "teoria",         label: "Teoria" },
    { value: "revisao",        label: "Revisão" },
    { value: "exercicio",      label: "Questões" },
    { value: "leitura",        label: "Leitura de Lei" },
    { value: "jurisprudencia", label: "Jurisprudência" },
  ];

  // ----------------- disciplinas (DB) -----------------
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState("");

  async function loadSubjects() {
    if (!userId) return;
    setLoadingSubjects(true);
    setSubjectsError("");
    try {
      const resp = await fetch(`${API_BASE}/api/subjects?userId=${encodeURIComponent(userId)}`);
      const data = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error((data && (data.error || data.message)) || "Falha ao carregar disciplinas");
      const list = Array.isArray(data) ? [...data].sort((a, b) => a.name.localeCompare(b.name)) : [];
      setSubjects(list);
    } catch (e) {
      setSubjectsError("Não foi possível carregar disciplinas.");
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }

  useEffect(() => {
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));

  return (
    <>
      <div className="rs-overlay add-study">
        <div
          className="rs-dialog"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rs-title"
        >
          <div className="rs-header">
            <h3 id="rs-title">Registro de Estudo</h3>
            <button className="rs-close" onClick={onClose} aria-label="Fechar">✕</button>
          </div>

          <form className="rs-body" onSubmit={onSubmit}>
            {/* Pills */}
            <div className="rs-pills">
              <button
                type="button"
                className={`rs-pill ${selectedDay === "today" ? "is-active" : ""}`}
                onClick={() => setSelectedDay("today")}
              >Hoje</button>
              <button
                type="button"
                className={`rs-pill ${selectedDay === "yesterday" ? "is-active" : ""}`}
                onClick={() => setSelectedDay("yesterday")}
              >Ontem</button>
              <button
                type="button"
                className={`rs-pill ${selectedDay === "custom" ? "is-active" : ""}`}
                onClick={() => setSelectedDay("custom")}
              >Outro</button>

              {selectedDay === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="rs-date"
                />
              )}
            </div>

            {/* Linha 1 */}
            <div className="rs-row">
              <div className="rs-field">
                <label className="rs-label">Categoria</label>
                <RSComboBox
                  options={categoryOptions}
                  value={form.category}
                  onChange={(v) => setField("category", v)}
                  placeholder="Selecione..."
                />
              </div>

              <div className="rs-field">
                <label className="rs-label">Disciplina</label>
                <RSComboBox
                  options={subjectOptions}
                  value={form.subject}
                  onChange={(v) => setField("subject", v)}
                  placeholder={loadingSubjects ? "Carregando..." : "Selecione..."}
                  disabled={loadingSubjects}
                />
                {subjectsError && <small style={{ color: "#ff9b9b" }}>{subjectsError}</small>}
              </div>

              <button
                type="button"
                className="rs-add"
                aria-label="Adicionar"
                title="Nova disciplina"
                onClick={() => setShowSubjectDialog(true)}
              >
                +
              </button>

              <div className="rs-field rs-field--time">
                <label className="rs-label">Tempo de Estudo</label>
                <input
                  className="rs-input"
                  type="time"
                  step="1"
                  value={form.duration}
                  onChange={(e) => setField("duration", e.target.value)}
                />
              </div>
            </div>

            {/* Conteúdo */}
            <div className="rs-field">
              <label className="rs-label">Conteúdo</label>
              <input
                className="rs-input"
                type="text"
                value={form.content}
                onChange={(e) => setField("content", e.target.value)}
              />
            </div>

            {/* Grupos: Questões e Páginas */}
            <div className="rs-row rs-grid-2">
              <fieldset className="rs-group">
                <legend className="rs-group__title">QUESTÕES</legend>

                <div className="rs-grid-2">
                  <div className="rs-counter-field">
                    <span className="rs-label--sm">Acertos</span>
                    <div className="rs-counter">
                      <input
                        className="rs-counter__input"
                        type="number"
                        min="0"
                        value={form.questionsRight}
                        onChange={(e) => setField("questionsRight", Number(e.target.value))}
                      />
                      <div className="rs-counter__btns">
                        <button
                          type="button"
                          onClick={() => dec("questionsRight")}
                          disabled={form.questionsRight <= 0}
                        >−</button>
                        <button type="button" onClick={() => inc("questionsRight")}>+</button>
                      </div>
                    </div>
                  </div>

                  <div className="rs-counter-field">
                    <span className="rs-label--sm">Erros</span>
                    <div className="rs-counter">
                      <input
                        className="rs-counter__input"
                        type="number"
                        min="0"
                        value={form.questionsWrong}
                        onChange={(e) => setField("questionsWrong", Number(e.target.value))}
                      />
                      <div className="rs-counter__btns">
                        <button
                          type="button"
                          onClick={() => dec("questionsWrong")}
                          disabled={form.questionsWrong <= 0}
                        >−</button>
                        <button type="button" onClick={() => inc("questionsWrong")}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>

              <fieldset className="rs-group">
                <legend className="rs-group__title">PÁGINAS</legend>

                <div className="rs-grid-2">
                  <div className="rs-counter-field">
                    <span className="rs-label--sm">Início</span>
                    <div className="rs-counter">
                      <input
                        className="rs-counter__input"
                        type="number"
                        min="0"
                        value={form.pageStart}
                        onChange={(e) => setField("pageStart", Number(e.target.value))}
                      />
                      <div className="rs-counter__btns">
                        <button
                          type="button"
                          onClick={() => dec("pageStart")}
                          disabled={form.pageStart <= 0}
                        >−</button>
                        <button type="button" onClick={() => inc("pageStart")}>+</button>
                      </div>
                    </div>
                  </div>

                  <div className="rs-counter-field">
                    <span className="rs-label--sm">Fim</span>
                    <div className="rs-counter">
                      <input
                        className="rs-counter__input"
                        type="number"
                        min="0"
                        value={form.pageEnd}
                        onChange={(e) => setField("pageEnd", Number(e.target.value))}
                      />
                      <div className="rs-counter__btns">
                        <button
                          type="button"
                          onClick={() => dec("pageEnd")}
                          disabled={form.pageEnd <= 0}
                        >−</button>
                        <button type="button" onClick={() => inc("pageEnd")}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Comentário */}
            <label className="rs-field">
              <span className="rs-label">Comentário</span>
              <textarea
                className="rs-textarea"
                rows={4}
                value={form.comment}
                onChange={(e) => setField("comment", e.target.value)}
              />
            </label>

            {/* Ações */}
            <div className="rs-actions">
              <button type="button" className="rs-btn btn btn-outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="rs-btn btn btn-solid">
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>

      {showSubjectDialog && (
        <SubjectDialog
          userId={userId}
          onClose={() => setShowSubjectDialog(false)}
          onCreated={(created) => {
            setSubjects((prev) => {
              const next = [...prev, created];
              next.sort((a, b) => a.name.localeCompare(b.name));
              return next;
            });
            setField("subject", created.id);
          }}
          onUpdated={(updated) => {
            setSubjects((prev) => {
              const next = prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s));
              next.sort((a, b) => a.name.localeCompare(b.name));
              return next;
            });
          }}
          onDeleted={(deletedId) => {
            setSubjects((prev) => prev.filter((s) => s.id !== deletedId));
            setForm((f) => (f.subject === deletedId ? { ...f, subject: "" } : f));
          }}
        />
      )}
    </>
  );
}
