import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const STORAGE_KEY = "study_timer_state_v1";
export const CHANNEL_NAME = "study-timer";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const st = JSON.parse(raw);
    if (
      typeof st?.baseElapsedMs === "number" &&
      (typeof st?.startMs === "number" || st?.startMs === null) &&
      typeof st?.running === "boolean"
    ) {
      return st;
    }
  } catch {}
  return null;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function fmtHMS(tSec) {
  const h = Math.floor(tSec / 3600).toString().padStart(2, "0");
  const m = Math.floor((tSec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(tSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Hook de timer compartilhado:
 * - Persistência em localStorage
 * - Sync entre abas via BroadcastChannel
 * - Fallback na mesma aba via CustomEvent
 * - Atualização visual suave via RAF quando running=true
 * - Exponho syncNow() para rebroadcast imediato (usado ao abrir o Dialog)
 */
export default function useSharedTimer({ onStop } = {}) {
  const [baseElapsedMs, setBaseElapsedMs] = useState(0); // acumulado
  const [startMs, setStartMs] = useState(null);          // início desta corrida
  const [running, setRunning] = useState(false);

  // tick visual
  const [nowTick, setNowTick] = useState(Date.now());
  const rafRef = useRef(null);

  // canais
  const bcRef = useRef(null);

  // hidratação inicial + setup canais
  useEffect(() => {
    const st = loadState();
    if (st) {
      setBaseElapsedMs(st.baseElapsedMs);
      setStartMs(st.startMs);
      setRunning(st.running);
    }

    // canal entre abas
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
    } catch {
      bcRef.current = null;
    }

    // fallback mesma aba
    const onCustom = (ev) => {
      const st2 = ev.detail;
      if (!st2) return;
      setBaseElapsedMs(st2.baseElapsedMs);
      setStartMs(st2.startMs);
      setRunning(st2.running);
    };
    window.addEventListener("timer-sync", onCustom);

    return () => {
      if (bcRef.current) bcRef.current.close();
      window.removeEventListener("timer-sync", onCustom);
    };
  }, []);

  // função de broadcast (canal + fallback)
  const broadcast = useCallback((state) => {
    if (bcRef.current) {
      bcRef.current.postMessage({ type: "timer-sync", payload: state });
    }
    window.dispatchEvent(new CustomEvent("timer-sync", { detail: state }));
  }, []);

  // persiste + broadcast a cada mudança
  useEffect(() => {
    const state = { baseElapsedMs, startMs, running };
    saveState(state);
    broadcast(state);
  }, [baseElapsedMs, startMs, running, broadcast]);

  // animação enquanto rodando
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [running]);

  // cálculo preciso
  const elapsedMs = useMemo(() => {
    if (running && typeof startMs === "number") {
      return baseElapsedMs + (Date.now() - startMs);
    }
    return baseElapsedMs;
  }, [running, startMs, baseElapsedMs, nowTick]);

  const elapsedSec = Math.floor(elapsedMs / 1000);

  // ações
  const onToggle = useCallback(() => {
    setRunning((prev) => {
      if (prev) {
        // Pausar → consolida
        setBaseElapsedMs((ms) => {
          if (startMs == null) return ms;
          return ms + (Date.now() - startMs);
        });
        setStartMs(null);
        return false;
      } else {
        // Iniciar
        setStartMs(Date.now());
        return true;
      }
    });
  }, [startMs]);

  const onReset = useCallback(() => {
    setBaseElapsedMs(0);
    setStartMs((cur) => (running ? Date.now() : null));
  }, [running]);

  const stop = useCallback(() => {
    let totalMs = baseElapsedMs;
    if (running && startMs != null) {
      totalMs = baseElapsedMs + (Date.now() - startMs);
    }
    setBaseElapsedMs(totalMs);
    setRunning(false);
    setStartMs(null);
    onStop?.(fmtHMS(Math.floor(totalMs / 1000)));
  }, [onStop, baseElapsedMs, running, startMs]);

  // segurança em reload/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveState({ baseElapsedMs, startMs, running });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [baseElapsedMs, startMs, running]);

  /**
   * Rebroadcast imediato do estado atual (útil antes de abrir o Dialog).
   * Garante que o componente que montar em seguida hidrate com os valores correntes
   * mesmo se o último broadcast tiver sido há algum tempo.
   */
  const syncNow = useCallback(() => {
    const state = { baseElapsedMs, startMs, running };
    // salva de novo e emite
    saveState(state);
    broadcast(state);
  }, [baseElapsedMs, startMs, running, broadcast]);

  return {
    running,
    elapsedSec,
    elapsedMs,
    onToggle,
    onReset,
    stop,
    syncNow, // ← exposto para o Home usar antes de abrir o Dialog
  };
}
