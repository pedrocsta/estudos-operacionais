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

export default function StudyTimerDialog({ onClose, onStop }) {
  // Acúmulo persistente (em ms) quando não estamos cronometrando
  const [baseElapsedMs, setBaseElapsedMs] = useState(0);
  // Timestamp de início da contagem atual (em ms) — null quando pausado
  const [startMs, setStartMs] = useState(null);
  // Estado "rodando"
  const [running, setRunning] = useState(false);
  // Usamos isso só para forçar re-render enquanto a aba está visível
  const [nowTick, setNowTick] = useState(Date.now());

  const rafRef = useRef(null);
  const panelRef = useRef(null);

  // Cálculo do elapsed total (em ms) com base em tempo real
  const elapsedMs = useMemo(() => {
    if (running && startMs != null) {
      return baseElapsedMs + (Date.now() - startMs);
    }
    return baseElapsedMs;
  }, [running, startMs, baseElapsedMs, nowTick]);

  const elapsedSec = Math.floor(elapsedMs / 1000);

  // Loop de animação apenas para atualizar a tela quando rodando e visível.
  useEffect(() => {
    if (!running) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      setNowTick(Date.now());
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  // Alterna play/pause usando timestamps (sem perder precisão)
  const onToggle = useCallback(() => {
    setRunning((prev) => {
      if (prev) {
        // Pausando: consolidar o delta em baseElapsedMs
        setBaseElapsedMs((ms) => {
          if (startMs == null) return ms;
          return ms + (Date.now() - startMs);
        });
        setStartMs(null);
        return false;
      } else {
        // Iniciando: marcar ponto de partida
        setStartMs(Date.now());
        return true;
      }
    });
  }, [startMs]);

  // Reset total
  const onReset = useCallback(() => {
    setBaseElapsedMs(0);
    if (running) {
      setStartMs(Date.now());
    } else {
      setStartMs(null);
    }
  }, [running]);

  // Parar e salvar (chama callback com tempo formatado)
  const stop = useCallback(() => {
    // Consolidar tempo se estiver rodando
    setBaseElapsedMs((ms) => {
      if (running && startMs != null) {
        const total = ms + (Date.now() - startMs);
        const totalSec = Math.floor(total / 1000);
        onStop?.(fmtHMS(totalSec));
        return total;
      } else {
        onStop?.(fmtHMS(Math.floor(ms / 1000)));
        return ms;
      }
    });
    setRunning(false);
    setStartMs(null);
  }, [onStop, running, startMs]);

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
