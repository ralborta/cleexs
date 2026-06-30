'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Avanza el % mostrado de forma continua hacia el target (nunca baja).
 * Si el backend tarda entre polls, hace un creep lento para que no parezca colgado.
 */
export function useSmoothProgress(target: number, enabled: boolean): number {
  const [displayed, setDisplayed] = useState(0);
  const displayedRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = Math.max(0, Math.min(100, target));

  useEffect(() => {
    if (!enabled) {
      displayedRef.current = 0;
      setDisplayed(0);
      return;
    }

    const id = window.setInterval(() => {
      const t = targetRef.current;
      let next = displayedRef.current;

      if (next < t - 0.2) {
        const gap = t - next;
        const step = Math.max(0.35, gap * 0.12);
        next = Math.min(t, next + step);
      } else if (next < 97 && t >= 50) {
        // Backend quieto: avance mínimo para no congelar la percepción (tope 97 hasta completed).
        next = Math.min(97, next + 0.22);
      }

      const rounded = Math.round(next);
      if (rounded !== Math.round(displayedRef.current)) {
        displayedRef.current = next;
        setDisplayed(rounded);
      } else {
        displayedRef.current = next;
      }
    }, 450);

    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const t = Math.max(0, Math.min(100, target));
    if (t > displayedRef.current + 2) {
      const jump = displayedRef.current + Math.max(1, (t - displayedRef.current) * 0.25);
      displayedRef.current = jump;
      setDisplayed(Math.round(jump));
    }
  }, [target, enabled]);

  return enabled ? displayed : 0;
}
