'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, Trophy } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'cleexs_portal_token';

type CheckoutAttribution = {
  refCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  sourceChannel?: string;
};

function readAttribution(): CheckoutAttribution {
  try {
    const raw =
      typeof window !== 'undefined' ? sessionStorage.getItem('cleexs_diagnostic_attribution') : null;
    if (!raw) return {};
    const j = JSON.parse(raw) as {
      ref?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };
    return {
      ...(j.ref ? { refCode: j.ref } : {}),
      ...(j.utm_source ? { utmSource: j.utm_source } : {}),
      ...(j.utm_medium ? { utmMedium: j.utm_medium } : {}),
      ...(j.utm_campaign ? { utmCampaign: j.utm_campaign } : {}),
    };
  } catch {
    return {};
  }
}

export async function startPlanConquistarCheckout(attribution: CheckoutAttribution = {}) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
  if (!token) {
    throw new Error('Para pagar y activar tus 90 días, primero iniciá sesión en el portal.');
  }

  const res = await fetch(`${API_URL}/api/subscriptions/plan-conquistar/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sourceChannel: 'plan_conquistar_landing',
      utmSource: 'cleexs',
      utmMedium: 'landing',
      utmCampaign: 'plan_conquistar_90d',
      ...readAttribution(),
      ...attribution,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
  if (!res.ok || !body.checkoutUrl) {
    throw new Error(body.error || 'No se pudo iniciar el pago.');
  }
  window.location.href = body.checkoutUrl;
}

const VARIANT_CLASSES = {
  default:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
  sidebar:
    'flex w-full items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
  compact:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
} as const;

export function PlanConquistarCheckoutButton({
  className = '',
  variant = 'default',
  label,
  sourceChannel,
  icon,
}: {
  className?: string;
  variant?: keyof typeof VARIANT_CLASSES;
  label?: string;
  sourceChannel?: string;
  icon?: 'trophy' | 'sparkles';
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLabel =
    variant === 'sidebar' ? 'Quiero conquistar ChatGPT' : 'Quiero ser el favorito de ChatGPT';
  const buttonLabel = label ?? defaultLabel;
  const Icon = icon === 'sparkles' || variant === 'sidebar' ? Sparkles : Trophy;

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      await startPlanConquistarCheckout(sourceChannel ? { sourceChannel } : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el pago.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={variant === 'sidebar' ? 'w-full' : 'flex flex-col items-center gap-2'}>
      <button
        type="button"
        onClick={() => void handleCheckout()}
        disabled={loading}
        className={`${VARIANT_CLASSES[variant]} ${className}`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4 shrink-0" />}
        {loading ? 'Abriendo Mercado Pago...' : buttonLabel}
      </button>
      {error ? (
        <p
          className={`text-sm text-amber-700 ${variant === 'sidebar' ? 'mt-2 text-[11px] leading-snug' : 'max-w-md text-center'}`}
        >
          {error}{' '}
          <Link href="/portal-crecimiento" className="font-semibold underline">
            Ir al portal
          </Link>
        </p>
      ) : null}
    </div>
  );
}
