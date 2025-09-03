import React, { useEffect, useRef, useState } from "react";
import SaveIcon from "../assets/save.svg";
import TrashIcon from "../assets/trash.svg";

const API_BASE = import.meta.env.VITE_API_URL || ""; // "" => mesmo host (se tiver proxy)

export default function SubjectDialog({ userId, onClose, onCreated, onUpdated, onDeleted }) {
  const panelRef = useRef(null);
  const pickingColorRef = useRef(false);

  // ===== criação =====
  const [name, setName] = useState("");
  const [color, setColor] = useState("#66F081");
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");
  const [colorError, setColorError] = useState("");

  // ===== listagem/edição =====
  const [subjects, setSubjects] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [savingMap, setSavingMap] = useState({});
  const [deletingMap, setDeletingMap] = useState({});
  const [rowErrors, setRowErrors] = useState({});

  // ===== lifecycle / outside click =====
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    function isEventInside(node, e) {
      const path = typeof e.composedPath === "function" ? e.composedPath() : undefined;
      if (Array.isArray(path) && path.length) return path.includes(node);
      return node?.contains(e.target);
    }
    let ignoreFirstClick = true;
    const unsetIgnore = setTimeout(() => { ignoreFirstClick = false; }, 0);
    function onClickOutside(e) {
      if (ignoreFirstClick) return;
      if (pickingColorRef.current) return;
      if (!panelRef.current) return;
      if (e.target && typeof e.target.closest === "function" && e.target.closest('input[type="color"]')) return;
      if (isEventInside(panelRef.current, e)) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClickOutside);
    return () => {
      clearTimeout(unsetIgnore);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClickOutside);
    };
  }, [onClose]);

  function beginColorPickGuard() {
    pickingColorRef.current = true;
    setTimeout(() => { pickingColorRef.current = false; }, 1200);
  }

  // ===== carregar lista =====
  useEffect(() => {
    async function load() {
      if (!userId) return;
      setListLoading(true);
      setListError("");
      try {
        const resp = await fetch(`${API_BASE}/api/subjects?userId=${encodeURIComponent(userId)}`);
        const data = await resp.json().catch(() => []);
        if (!resp.ok) throw new Error((data && (data.error || data.message)) || "Erro ao listar");
        setSubjects(Array.isArray(data) ? data : []);
      } catch (err) {
        setListError("Não foi possível carregar suas disciplinas.");
      } finally {
        setListLoading(false);
      }
    }
    load();
  }, [userId]);

  // ===== criar =====
  async function handleSubmit(e) {
    e.preventDefault();
    setNameError("");
    setColorError("");

    const trimmed = name.trim();
    let hasError = false;

    if (!userId) { setNameError("Sessão inválida: usuário não identificado."); hasError = true; }
    if (!trimmed) { setNameError("Informe um nome."); hasError = true; }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) { setColorError("Cor inválida. Use #RRGGBB."); hasError = true; }
    if (hasError) return;

    setSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: String(userId), name: trimmed, color }),
      });

      let data = null, raw = "";
      try { data = await resp.json(); } catch { try { raw = await resp.text(); } catch {} }

      if (!resp.ok) {
        const msg = (data && (data.error || data.message)) || raw || "Erro ao criar disciplina.";
        if (resp.status === 409) setNameError(msg || "Já existe uma disciplina com esse nome.");
        else if (resp.status === 400 && /usuário|userId/i.test(msg)) setNameError("Sessão inválida: usuário não identificado.");
        else if (resp.status === 400 && /cor|color/i.test(msg)) setColorError(msg);
        else setNameError(msg);
        return;
      }

      const created = data || {};
      setSubjects((prev) => {
        const next = [...prev, created];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      onCreated?.(created);

      setName("");
      setColor("#66F081");
    } catch (err) {
      console.error("POST /api/subjects failed:", err);
      setNameError("Não foi possível comunicar com o servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  // ===== helpers por item =====
  function setRowError(id, field, msg) {
    setRowErrors((m) => ({ ...m, [id]: { ...(m[id] || {}), [field]: msg } }));
  }
  function clearRowErrors(id) {
    setRowErrors((m) => ({ ...m, [id]: {} }));
  }
  function setSaving(id, v) {
    setSavingMap((m) => ({ ...m, [id]: v }));
  }
  function setDeleting(id, v) {
    setDeletingMap((m) => ({ ...m, [id]: v }));
  }

  // ===== salvar edição =====
  async function saveRow(row) {
    clearRowErrors(row.id);

    const trimmedName = (row.name || "").trim();
    let hasError = false;
    if (!trimmedName) { setRowError(row.id, "name", "Informe um nome."); hasError = true; }
    if (!/^#[0-9A-Fa-f]{6}$/.test(row.color || "")) { setRowError(row.id, "color", "Cor inválida. Use #RRGGBB."); hasError = true; }
    if (hasError) return;

    setSaving(row.id, true);
    try {
      const resp = await fetch(`${API_BASE}/api/subjects/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, color: row.color }),
      });
      let data = null, raw = "";
      try { data = await resp.json(); } catch { try { raw = await resp.text(); } catch {} }

      if (!resp.ok) {
        const msg = (data && (data.error || data.message)) || raw || `Erro ao salvar (HTTP ${resp.status}).`;
        if (resp.status === 409) setRowError(row.id, "name", "Já existe uma disciplina com esse nome.");
        else if (/cor|color/i.test(msg)) setRowError(row.id, "color", msg);
        else setRowError(row.id, "name", msg);
        return;
      }

      const updated = data || {};
      setSubjects((prev) => {
        const next = prev.map((s) => (s.id === row.id ? { ...s, ...updated } : s));
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      onUpdated?.(updated);
    } catch (err) {
      console.error("PUT /api/subjects/:id failed:", err);
      setRowError(row.id, "name", "Falha de comunicação com o servidor.");
    } finally {
      setSaving(row.id, false);
    }
  }

  // ===== excluir =====
  async function deleteRow(id) {
    setDeleting(id, true);
    try {
      const resp = await fetch(`${API_BASE}/api/subjects/${id}`, { method: "DELETE" });

      if (resp.status === 200 || resp.status === 204 || resp.ok) {
        setSubjects((prev) => prev.filter((s) => s.id !== id));
        onDeleted?.(id);
        return;
      }

      let data = null, raw = "";
      try { data = await resp.json(); } catch { try { raw = await resp.text(); } catch {} }
      const msg = (data && (data.error || data.message)) || raw || `Erro ao excluir (HTTP ${resp.status}).`;
      setRowError(id, "name", msg);
    } catch (err) {
      console.error("DELETE /api/subjects/:id failed:", err);
      setRowError(id, "name", "Falha de comunicação com o servidor.");
    } finally {
      setDeleting(id, false);
    }
  }

  return (
    <div className="rs-overlay">
      <div
        className="rs-dialog-matter"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="rs-header">
          <h3 id="subject-title">Nova disciplina</h3>
          <button className="rs-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        {/* CRIAÇÃO – só Cor e Nome */}
        <form className="rs-body" onSubmit={handleSubmit}>
          <div className="rs-row" style={{ gridTemplateColumns: "0.1fr 1fr" }}>
            <div className="rs-field">
              <label className="rs-label">Cor</label>
              <input
                className="rs-input-color"
                type="color"
                value={color}
                onMouseDown={beginColorPickGuard}
                onClick={beginColorPickGuard}
                onInput={(e) => { setColor(e.target.value); pickingColorRef.current = false; }}
                onChange={(e) => { setColor(e.target.value); pickingColorRef.current = false; }}
                style={{ padding: 0, height: 38 }}
                aria-label="Selecionar cor"
              />
              {colorError && (
                <small style={{ color: "#ff9b9b", fontSize: 12, marginTop: 6, display: "block" }}>{colorError}</small>
              )}
            </div>

            <div className="rs-field">
              <label className="rs-label">Nome</label>
              <input
                className="rs-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {nameError && (
                <small style={{ color: "#ff9b9b", fontSize: 12, marginTop: 6, display: "block" }}>{nameError}</small>
              )}
            </div>
          </div>

          <div className="rs-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="rs-btn btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="rs-btn btn btn-solid" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>

        {/* LISTAGEM – cabeçalho uma vez só */}
        <div className="rs-body" style={{ paddingTop: 0 }}>
          {listLoading && <div className="rs-label">Carregando...</div>}
          {listError && <div className="rs-label" style={{ color: "#ff9b9b" }}>{listError}</div>}
          {!listLoading && !subjects.length && <div className="rs-label">Nenhuma disciplina ainda.</div>}

          {!!subjects.length && (
            <>
              {/* Cabeçalho único */}
              <div className="rs-list-head">
                <div className="rs-field"><span className="rs-label">Cor</span></div>
                <div className="rs-field"><span className="rs-label">Nome</span></div>
              </div>

              {/* Itens roláveis */}
              <div className="rs-list-scroll">
                <div className="rs-grid-2" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
                  {subjects.map((s) => (
                    <RowEditor
                      key={s.id}
                      item={s}
                      onChange={(next) => {
                        setSubjects((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...next } : x)));
                        setRowErrors((m) => ({ ...m, [s.id]: {} }));
                      }}
                      onSave={(current) => saveRow(current)}
                      onDelete={() => deleteRow(s.id)}
                      errors={rowErrors[s.id] || {}}
                      saving={!!savingMap[s.id]}
                      deleting={!!deletingMap[s.id]}
                      beginColorPickGuard={beginColorPickGuard}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Editor inline – sem labels por item */
function RowEditor({ item, onChange, onSave, onDelete, errors, saving, deleting, beginColorPickGuard }) {
  return (
    <div
      className="rs-row"
      style={{ gridTemplateColumns: "0.1349fr 1fr auto auto", alignItems: "center" }}
    >
      {/* Cor (sem label) */}
      <div className="rs-field">
        <input
          className="rs-input-color"
          type="color"
          value={item.color}
          onMouseDown={beginColorPickGuard}
          onClick={beginColorPickGuard}
          onInput={(e) => onChange({ color: e.target.value })}
          onChange={(e) => onChange({ color: e.target.value })}
          style={{ padding: 0, height: 38 }}
          aria-label={`Selecionar cor para ${item.name || "disciplina"}`}
        />
        {errors.color && (
          <small style={{ color: "#ff9b9b", fontSize: 12, marginTop: 6, display: "block" }}>
            {errors.color}
          </small>
        )}
      </div>

      {/* Nome (sem label) */}
      <div className="rs-field">
        <input
          className="rs-input"
          type="text"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {errors.name && (
          <small style={{ color: "#ff9b9b", fontSize: 12, marginTop: 6, display: "block" }}>
            {errors.name}
          </small>
        )}
      </div>

      {/* Salvar */}
      <div className="rs-field" style={{ alignSelf: "end" }}>
        <button
          type="button"
          className="btn btn-solid"
          onClick={() => onSave({ ...item })}
          disabled={saving || deleting}
          title="Salvar alterações"
          aria-label="Salvar alterações"
          style={{
            height: 38,
            width: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 0,
            borderRadius: 12,
          }}
        >
          {saving ? "..." : (
            <img
              src={SaveIcon}
              alt=""
              aria-hidden="true"
              style={{ width: 18, height: 18, filter: "invert(100%)" }}
            />
          )}
        </button>
      </div>

      {/* Excluir */}
      <div className="rs-field" style={{ alignSelf: "end" }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onDelete}
          disabled={saving || deleting}
          title="Excluir disciplina"
          aria-label="Excluir disciplina"
          style={{
            height: 38,
            width: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 0,
            borderRadius: 12,
          }}
        >
          {deleting ? "..." : (
            <img
              src={TrashIcon}
              alt=""
              aria-hidden="true"
              style={{ width: 18, height: 18, filter: "invert(100%)" }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
