'use client';

import { useEffect, useRef } from 'react';
import { CLEEXS_MARKETING_URL } from '@/lib/site';

const LEGAL_RETURN_KEY = 'cleexsLegalReturn';

export function rememberLegalReturnUrl(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LEGAL_RETURN_KEY, window.location.href);
}

export function consumeLegalReturnUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = sessionStorage.getItem(LEGAL_RETURN_KEY);
  if (url) sessionStorage.removeItem(LEGAL_RETURN_KEY);
  return url;
}

/** Salida explícita del funnel público → marketing (cleexs.net), nunca rutas internas de la app. */
export function exitPublicFunnelToMarketingSite(): void {
  if (typeof window === 'undefined') return;
  window.location.assign(CLEEXS_MARKETING_URL);
}

/** Botón «atrás» del navegador en pantalla de error del funnel → cleexs.net (no `/diagnostico/crear`). */
export function usePublicFunnelBackToMarketing(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    window.history.pushState({ cleexsPublicFunnel: true }, '', window.location.href);

    const onPopState = () => {
      exitPublicFunnelToMarketingSite();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled]);
}

/** Cierra overlays/modales con el botón atrás del navegador sin salir de la página. */
export function useTrapBrowserBack(enabled: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    window.history.pushState({ cleexsOverlayBack: true }, '', window.location.href);

    const onPopState = () => {
      onBackRef.current();
      window.history.pushState({ cleexsOverlayBack: true }, '', window.location.href);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled]);
}
