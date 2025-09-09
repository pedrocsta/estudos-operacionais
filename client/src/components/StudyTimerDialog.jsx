import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PlayIcon from "../assets/icons/play.svg";
import PauseIcon from "../assets/icons/pause.svg";
import StopIcon from "../assets/icons/stop.svg";
import RestartIcon from "../assets/icons/restart.svg";
import MinimizeIcon from "../assets/icons/minimize.svg";

const logoSrc = "/logo.png";

function fmtHMS(tSec) {
  const h = Math.floor(tSec / 3600).toString().padStart(2, "0");
  const m = Math.floor((tSec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(tSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * StudyTimerDialog sincronizado por relógio do sistema.
 *
 * Props:
 * - onClose?: () => void
 * - onStop?: (formattedElapsed: string) => void
 * - timerKey?: string   // chave do localStorage (default: "study_timer_v1")
 *
 * Como funciona:
 * - Ao iniciar, salva startWallMs = Date.now() no localStorage.
 * - elapsed = baseElapsedMs + (Date.now() - startWallMs) quando running = true.
 * - Pausas consolidam no baseElapsedMs.
 * - Ao reabrir a página (ou voltar do background), o cálculo continua correto.
 */
export default function StudyTimerDialog({ onClose, onStop, timerKey = "study_timer_v1" }) {
  // Estado persistido
  const [running, setRunning] = useState(false);
  const [startWallMs, setStartWallMs] = useState(null); // Date.now() quando deu play
  const [baseElapsedMs, setBaseElapsedMs] = useState(0); // acumulado de sessões anteriores

  // Apenas para animar a UI quando a aba está visível
  const [nowTick, setNowTick] = useState(Date.now());
  const rafRef = useRef(null);
  const panelRef = useRef(null);

  // Helpers de storage
  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(timerKey);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (
        typeof s?.baseElapsedMs === "number" &&
        (typeof s?.startWallMs === "number" || s?.startWallMs === null) &&
        typeof s?.running === "boolean"
      ) {
        return s;
      }
    } catch {}
    return null;
  }, [timerKey]);

  const save = useCallback(
    (state) => {
      try {
        localStorage.setItem(timerKey, JSON.stringify(state));
      } catch {}
    },
    [timerKey]
  );

  // Reidratar ao montar
  useEffect(() => {
    const s = load();
    if (s) {
      setRunning(s.running);
      setStartWallMs(s.startWallMs);
      setBaseElapsedMs(s.baseElapsedMs);
    } else {
      save({ running: false, startWallMs: null, baseElapsedMs: 0 });
    }
  }, [load, save]);

  // Sincronizar entre abas
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== timerKey || e.newValue == null) return;
      try {
        const s = JSON.parse(e.newValue);
        if (!s) return;
        setRunning(s.running);
        setStartWallMs(s.startWallMs);
        setBaseElapsedMs(s.baseElapsedMs);
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [timerKey]);

  // Loop de atualização visual
  useEffect(() => {
    const tick = () => {
      setNowTick(Date.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    if (running) {
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [running]);

  // Garante um “refresh” imediato quando a aba volta a ficar visível
  useEffect(() => {
    const onVis = () => setNowTick(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Cálculo sincronizado com o relógio do sistema
  const elapsedMs = useMemo(() => {
    if (running && typeof startWallMs === "number") {
      const delta = Date.now() - startWallMs;
      return Math.max(0, baseElapsedMs + delta); // clamp evita valores negativos se o relógio do SO recuar
    }
    return baseElapsedMs;
  }, [running, startWallMs, baseElapsedMs, nowTick]);

  const elapsedSec = Math.floor(elapsedMs / 1000);

  // Persistir a cada mudança
  useEffect(() => {
    save({ running, startWallMs, baseElapsedMs });
  }, [running, startWallMs, baseElapsedMs, save]);

  // Ações
  const onToggle = useCallback(() => {
    setRunning((prev) => {
      if (prev) {
        // Pausar: consolidar delta no baseElapsedMs
        setBaseElapsedMs((ms) => {
          if (typeof startWallMs !== "number") return ms;
          const total = ms + (Date.now() - startWallMs);
          return Math.max(0, total);
        });
        setStartWallMs(null);
        return false;
      } else {
        // Iniciar: gravar hora de play
        setStartWallMs(Date.now());
        return true;
      }
    });
  }, [startWallMs]);

  const onReset = useCallback(() => {
    // Zera acumulado; se estiver rodando, reinicia a partir de agora
    setBaseElapsedMs(0);
    setStartWallMs((cur) => (running ? Date.now() : null));
  }, [running]);

  const stop = useCallback(() => {
    // Consolida antes de parar
    let total = baseElapsedMs;
    if (running && typeof startWallMs === "number") {
      total = baseElapsedMs + (Date.now() - startWallMs);
    }
    total = Math.max(0, total);
    setBaseElapsedMs(total);
    setRunning(false);
    setStartWallMs(null);
    onStop?.(fmtHMS(Math.floor(total / 1000)));
  }, [onStop, baseElapsedMs, running, startWallMs]);

  return (
    <div className="rs-overlay dialog-time">
      <div
        className="rs-dialog dialog-time"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timer-title"
        style={{ minWidth: "100%", minHeight: "100%" }}
      >
        <div
          className="rs-body dialog-time"
          style={{
            paddingTop: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <img src={logoSrc} alt="Logo" style={{ width: 110, height: "auto" }} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span className="time">{fmtHMS(elapsedSec)}</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 0 4px",
            }}
          >
            <button
              type="button"
              onClick={onToggle}
              title={running ? "Pausar" : "Iniciar"}
              aria-label={running ? "Pausar" : "Iniciar"}
              className={`btn-dialog-time ${running ? "pause-btn-dialog" : "play-btn-dialog"}`}
            >
              <img src={running ? PauseIcon : PlayIcon} alt="" />
            </button>

            <button
              type="button"
              onClick={stop}
              title="Parar e salvar"
              aria-label="Parar e salvar"
              className="btn-dialog-time"
            >
              <img src={StopIcon} alt="" />
            </button>

            <button
              type="button"
              onClick={onReset}
              title="Reiniciar"
              aria-label="Reiniciar"
              className="btn-dialog-time"
              disabled={elapsedSec === 0}
            >
              <img src={RestartIcon} alt="" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Minimizar"
              aria-label="Minimizar"
              className="btn-dialog-time"
            >
              <img src={MinimizeIcon} alt="" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
