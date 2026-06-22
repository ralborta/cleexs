'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resolveApiBaseUrl } from '@/lib/api-base-url';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, Trophy } from 'lucide-react';

const API_URL = resolveApiBaseUrl();
const TOKEN_KEY = 'cleexs_portal_token';

export const PLAN_CONQUISTAR_OLD_PRICE = 'USD 199';
export const PLAN_CONQUISTAR_PRICE = 'USD 99 pago único';
/** @deprecated usar PLAN_CONQUISTAR_PRICE */
export const PLAN_CONQUISTAR_PROMO_PRICE = PLAN_CONQUISTAR_PRICE;

type CheckoutAttribution = {
  refCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  sourceChannel?: string;
  diagnosticId?: string;
  customerEmail?: string;
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

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/subscriptions/plan-conquistar/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sourceChannel: 'plan_conquistar_landing',
      utmSource: 'cleexs',
      utmMedium: 'landing',
      utmCampaign: 'plan_conquistar_90d',
      ...readAttribution(),
      ...attribution,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    checkoutUrl?: string;
    error?: string;
    portalToken?: string;
    portalEmail?: string;
  };
  if (!res.ok || !body.checkoutUrl) {
    throw new Error(body.error || 'No se pudo iniciar el pago.');
  }

  if (body.portalToken && typeof window !== 'undefined') {
    sessionStorage.setItem(TOKEN_KEY, body.portalToken);
  }

  window.location.href = body.checkoutUrl;
}

export function PlanConquistarPromoPrice({
  className,
  size = 'sm',
  inverted = false,
}: {
  className?: string;
  size?: 'sm' | 'md';
  inverted?: boolean;
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5', className)}>
      <span
        className={cn(
          'line-through decoration-2',
          size === 'md' ? 'text-sm' : 'text-[11px]',
          inverted ? 'text-white/55 decoration-white/55' : 'text-slate-400 decoration-slate-400/80'
        )}
      >
        {PLAN_CONQUISTAR_OLD_PRICE}
      </span>
      <span
        className={cn(
          'font-black tracking-tight',
          size === 'md' ? 'text-base' : 'text-xs',
          inverted ? 'text-white' : 'text-violet-700'
        )}
      >
        {PLAN_CONQUISTAR_PRICE}
      </span>
    </span>
  );
}

const VARIANT_CLASSES = {
  default:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
  sidebar:
    'flex w-full items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
  compact:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:shadow-md active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
  promo:
    'inline-flex items-center justify-center gap-2.5 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
  overlay:
    'inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/95 px-5 py-2.5 text-xs font-bold text-violet-800 shadow-lg shadow-violet-900/10 backdrop-blur transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
} as const;

export function PlanConquistarCheckoutButton({
  className = '',
  variant = 'default',
  label,
  sourceChannel,
  icon,
  showPromoPrice = false,
  loading: externalLoading,
  onCheckoutStart,
  onCheckoutError,
  diagnosticId,
  customerEmail,
}: {
  className?: string;
  variant?: keyof typeof VARIANT_CLASSES;
  label?: string;
  sourceChannel?: string;
  icon?: 'trophy' | 'sparkles';
  showPromoPrice?: boolean;
  loading?: boolean;
  onCheckoutStart?: () => void;
  onCheckoutError?: (message: string) => void;
  diagnosticId?: string | null;
  customerEmail?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoading = loading || Boolean(externalLoading);

  const defaultLabel =
    variant === 'sidebar' ? 'Quiero conquistar ChatGPT' : 'Quiero ser el favorito de ChatGPT';
  const buttonLabel = label ?? defaultLabel;
  const Icon = icon === 'sparkles' || variant === 'sidebar' ? Sparkles : Trophy;
  const showPriceBlock = showPromoPrice;

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    onCheckoutStart?.();
    try {
      await startPlanConquistarCheckout({
        ...(sourceChannel ? { sourceChannel } : {}),
        ...(diagnosticId ? { diagnosticId } : {}),
        ...(customerEmail ? { customerEmail } : {}),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo iniciar el pago.';
      setError(message);
      onCheckoutError?.(message);
    } finally {
      setLoading(false);
    }
  }

  const buttonContent =
    showPriceBlock && !isLoading ? (
      <>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
          <Icon className="h-4 w-4 shrink-0" />
        </span>
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-sm font-bold">{buttonLabel}</span>
          <PlanConquistarPromoPrice size="sm" inverted className="mt-0.5" />
        </span>
      </>
    ) : (
      <>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4 shrink-0" />}
        {isLoading ? 'Abriendo Mercado Pago...' : buttonLabel}
      </>
    );

  return (
    <div className={variant === 'sidebar' ? 'w-full' : 'flex flex-col items-center gap-2'}>
      <button
        type="button"
        onClick={() => void handleCheckout()}
        disabled={isLoading}
        className={cn(VARIANT_CLASSES[variant], className)}
      >
        {buttonContent}
      </button>
      {error ? (
        <p
          className={cn(
            'text-sm text-amber-700',
            variant === 'sidebar' ? 'mt-2 text-[11px] leading-snug' : 'max-w-md text-center'
          )}
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
