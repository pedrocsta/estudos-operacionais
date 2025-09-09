import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PlayIcon from "../assets/icons/play.svg";
import PauseIcon from "../assets/icons/pause.svg";
import StopIcon from "../assets/icons/stop.svg";
import RestartIcon from "../assets/icons/restart.svg";
import MinimizeIcon from "../assets/icons/minimize.svg";

const logoSrc = "/logo.png";
const STORAGE_KEY = "study_timer_state_v1";
const CHANNEL_NAME = "study-timer";

function fmtHMS(tSec) {
  const h = Math.floor(tSec / 3600).toString().padStart(2, "0");
  const m = Math.floor((tSec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(tSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.baseElapsedMs === "number" &&
      (typeof parsed?.startMs === "number" || parsed?.startMs === null) &&
      typeof parsed?.running === "boolean"
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export default function StudyTimerDialog({
  onClose,
  onStop,
}) {
  // Estado persistente
  const [baseElapsedMs, setBaseElapsedMs] = useState(0); // acumulado
  const [startMs, setStartMs] = useState(null);          // inicio da corrida atual
  const [running, setRunning] = useState(false);         // está rodando?

  // Re-render para animar quando visível
  const [nowTick, setNowTick] = useState(Date.now());
  const rafRef = useRef(null);
  const bcRef = useRef(null);
  const panelRef = useRef(null);

  // Hidratação inicial do storage
  useEffect(() => {
    const st = loadState();
    if (st) {
      setBaseElapsedMs(st.baseElapsedMs);
      setStartMs(st.startMs);
      setRunning(st.running);
    }
    // Canal para sincronizar entre abas
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (msg?.type === "timer-sync" && msg?.payload) {
          const { baseElapsedMs, startMs, running } = msg.payload;
          setBaseElapsedMs(baseElapsedMs);
          setStartMs(startMs);
          setRunning(running);
        }
      };
      bcRef.current = bc;
      return () => bc.close();
    } catch {
      bcRef.current = null;
    }
  }, []);

  // Persistência a cada mudança relevante
  useEffect(() => {
    const state = { baseElapsedMs, startMs, running };
    saveState(state);
    if (bcRef.current) {
      bcRef.current.postMessage({ type: "timer-sync", payload: state });
    }
  }, [baseElapsedMs, startMs, running]);

  // Loop de UI (apenas quando rodando e aba visível)
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

  // Calcula o elapsed com base no tempo real
  const elapsedMs = useMemo(() => {
    if (running && typeof startMs === "number") {
      // Mesmo se a UI “parar” em background/fechada, este cálculo fica correto ao reabrir
      return baseElapsedMs + (Date.now() - startMs);
    }
    return baseElapsedMs;
  }, [running, startMs, baseElapsedMs, nowTick]);

  const elapsedSec = Math.floor(elapsedMs / 1000);

  // Alterna entre iniciar/pausar com precisão e persistência
  const onToggle = useCallback(() => {
    setRunning((prev) => {
      if (prev) {
        // Pausar: consolidar o delta atual no baseElapsedMs
        setBaseElapsedMs((ms) => {
          if (startMs == null) return ms;
          return ms + (Date.now() - startMs);
        });
        setStartMs(null);
        return false;
      } else {
        // Iniciar: registrar o ponto de partida agora
        setStartMs(Date.now());
        return true;
      }
    });
  }, [startMs]);

  // Reset total (mantém consistência mesmo se estiver rodando)
  const onReset = useCallback(() => {
    setBaseElapsedMs(0);
    setStartMs((curStart) => (running ? Date.now() : null));
  }, [running]);

  // Parar e salvar
  const stop = useCallback(() => {
    // Consolidar antes de parar
    let totalMs = baseElapsedMs;
    if (running && startMs != null) {
      totalMs = baseElapsedMs + (Date.now() - startMs);
    }
    setBaseElapsedMs(totalMs);
    setRunning(false);
    setStartMs(null);
    onStop?.(fmtHMS(Math.floor(totalMs / 1000)));
  }, [onStop, baseElapsedMs, running, startMs]);

  // Segurança: se a aba for fechada/recarregada enquanto rodando, o storage já tem startMs/running
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveState({ baseElapsedMs, startMs, running });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [baseElapsedMs, startMs, running]);

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
          <img
            src={logoSrc}
            alt="Logo"
            style={{ width: 110, height: "auto" }}
          />

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
