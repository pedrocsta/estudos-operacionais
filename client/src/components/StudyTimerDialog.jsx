import React, { useRef, useCallback } from "react";
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

export default function StudyTimerDialog({
  onClose,
  onStop,
  elapsed = 0,
  running = false,
  onToggle,
  onReset,
}) {
  const panelRef = useRef(null);

  const stop = useCallback(() => {
    onStop?.(fmtHMS(elapsed));
  }, [elapsed, onStop]);

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
            <span className="time">{fmtHMS(elapsed)}</span>
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
              disabled={elapsed === 0}
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
