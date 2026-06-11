'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Trophy } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'cleexs_portal_token';

export function PlanConquistarCheckoutButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
      if (!token) {
        setError('Para pagar y activar tus 90 días, primero iniciá sesión en el portal.');
        return;
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
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !body.checkoutUrl) {
        throw new Error(body.error || 'No se pudo iniciar el pago.');
      }

      window.location.href = body.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el pago.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${className}`}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
        {loading ? 'Abriendo MercadoPago...' : 'Quiero ser el favorito de ChatGPT'}
      </button>
      {error ? (
        <p className="max-w-md text-center text-sm text-amber-700">
          {error}{' '}
          <Link href="/portal-crecimiento" className="font-semibold underline">
            Ir al portal
          </Link>
        </p>
      ) : null}
    </div>
  );
}
