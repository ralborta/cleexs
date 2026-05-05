'use client';

import { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ReferralMeResponse = {
  referralSlug?: string;
  goal?: number;
  referralCount?: number;
  rewarded?: boolean;
  upsellDismissed?: boolean;
};

export function PortalReferralUpsell() {
  const [data, setData] = useState<ReferralMeResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token =
        typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
      if (!token || token.length < 20) {
        setData(null);
        return;
      }
      const res = await fetch(`${API_URL}/api/me/referral`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setData(null);
        return;
      }
      if (!res.ok) {
        setLoadErr('No se pudo cargar el programa de referidos.');
        return;
      }
      const json = (await res.json()) as ReferralMeResponse;
      setLoadErr(null);
      setData(json);
    } catch {
      setLoadErr('No se pudo cargar el programa de referidos.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shareUrl =
    typeof window !== 'undefined' && data?.referralSlug
      ? `${window.location.origin}/portal-cliente?ref=${encodeURIComponent(data.referralSlug)}`
      : '';

  const onCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const onDismiss = async () => {
    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) return;
      setDismissing(true);
      const res = await fetch(`${API_URL}/api/me/referral/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setData((prev) => (prev ? { ...prev, upsellDismissed: true } : prev));
    } finally {
      setDismissing(false);
    }
  };

  if (!data || data.upsellDismissed) return null;

  const goal = data.goal ?? 20;
  const count = Math.min(data.referralCount ?? 0, goal);
  const pct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;

  return (
    <aside
      className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
      aria-label="Programa de referidos"
    >
      {loadErr ? <p className="text-[10px] text-rose-600">{loadErr}</p> : null}

      {data.rewarded ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-700/90">
              Meta alcanzada
            </p>
            <p className="text-[11px] leading-snug text-slate-700">
              Activamos el acceso promocional a Crecimiento en tu cuenta (bundle valor referencial USD&nbsp;99).
              Revisá tu plan en el portal o contactá soporte si no ves los cambios en minutos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onDismiss()}
            disabled={dismissing}
            className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {dismissing ? '…' : 'Ocultar'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Invitaciones
              </p>
              <p className="text-[11px] leading-snug text-slate-700">
                Por tiempo limitado: si{' '}
                <span className="font-semibold text-slate-900">{goal} cuentas nuevas</span> se registran con tu
                enlace, desbloqueamos en la tuya el bundle referencial (curso + reporte + plan de acción, valor USD&nbsp;99)
                sin cargo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onDismiss()}
              disabled={dismissing}
              className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
              title="Ocultar este aviso"
            >
              {dismissing ? '…' : 'Cerrar'}
            </button>
          </div>

          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums text-slate-500">
              <span>
                Progreso:{' '}
                <span className="font-semibold text-slate-700">
                  {count}/{goal}
                </span>
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onCopy()}
              className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            <code className="max-w-full truncate rounded border border-slate-100 bg-slate-50/90 px-2 py-1 text-[10px] text-slate-600">
              {shareUrl || '…'}
            </code>
          </div>
        </>
      )}
    </aside>
  );
}
