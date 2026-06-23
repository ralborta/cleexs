'use client';

import { useEffect } from 'react';
import { CLEEXS_MARKETING_URL } from '@/lib/site';

/** Salida explícita del funnel público → marketing (cleexs.net), nunca rutas internas de la app. */
export function exitPublicFunnelToMarketingSite(): void {
  if (typeof window === 'undefined') return;
  window.location.assign(CLEEXS_MARKETING_URL);
}

/** Botón «atrás» del navegador: siempre vuelve a cleexs.net en el funnel de diagnóstico. */
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
