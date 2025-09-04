import React, { useEffect, useMemo, useRef, useState } from "react";
import AngleDown from "../assets/icons/angle-down.svg";

export default function RSComboBox({
  options = [],
  value,
  onChange,
  placeholder = "Selecione...",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // fecha ao clicar fora; não fecha ao clicar dentro do combo
  useEffect(() => {
    function onDocMouseDown(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, list.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = list[highlight];
        if (item) {
          onChange?.(item.value);
          setQuery("");
          setOpen(false);
          inputRef.current?.blur();
        }
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, list, highlight, onChange]);

  // abrir sempre; foca antes do mouseup
  function openMenu() {
    if (disabled) return;
    if (!open) setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // MOSTRA: quando aberto, mostra query; quando fechado, mostra o label selecionado
  const displayValue = open ? query : (selected?.label || "");

  return (
    <div
      ref={rootRef}
      className={`rs-combo ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
    >
      <div
        className="rs-combo__control"
        onMouseDown={(e) => {
          e.preventDefault();
          openMenu();
        }}
      >
        <input
          ref={inputRef}
          className="rs-combo__input"
          // sempre mostra placeholder fixo
          placeholder={placeholder}
          // quando fechado: mostra o label selecionado, quando aberto: a query digitada
          value={displayValue}
          onChange={(e) => {
            // digitação controla apenas a busca
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onFocus={() => openMenu()}
          disabled={disabled}
        />

        <button
          type="button"
          className="rs-combo__arrow"
          tabIndex={-1}
          aria-label="Abrir"
          onMouseDown={(e) => {
            e.preventDefault();
            openMenu();
          }}
        >
          <img
            src={AngleDown}
            alt=""
            aria-hidden="true"
            className="user-chip-caret"
            draggable="false"
          />
        </button>
      </div>

      {open && (
        <ul className="rs-combo__menu" role="listbox">
          {list.length === 0 && <li className="rs-combo__empty">Nenhum resultado</li>}
          {list.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              className={
                "rs-combo__item" +
                (i === highlight ? " is-active" : "") +
                (value === o.value ? " is-selected" : "")
              }
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                // evita blur antes da seleção
                e.preventDefault();
                onChange?.(o.value);   // atualiza o valor externo
                setQuery("");          // limpa a query para o próximo uso
                setOpen(false);        // fecha o menu
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
