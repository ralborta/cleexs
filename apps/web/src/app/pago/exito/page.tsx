'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { resolveApiBaseUrl } from '@/lib/api-base-url';

const API_URL = resolveApiBaseUrl();

type PaymentStatus = {
  ok?: boolean;
  status?: string;
  premiumActive?: boolean;
  portalEmail?: string | null;
  portalUrl?: string;
};

function PagoExitoContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment');
  const product = searchParams.get('product');
  const pending = searchParams.get('status') === 'pending';
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [polling, setPolling] = useState(Boolean(paymentId && product === 'plan-conquistar'));

  useEffect(() => {
    if (!paymentId || product !== 'plan-conquistar') return;

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      try {
        const res = await fetch(
          `${API_URL}/api/subscriptions/plan-conquistar/payment/${encodeURIComponent(paymentId!)}/status`,
          { cache: 'no-store' },
        );
        const body = (await res.json().catch(() => ({}))) as PaymentStatus;
        if (cancelled) return;
        setStatus(body);
        if (body.premiumActive || body.status === 'approved') {
          setPolling(false);
          return;
        }
      } catch {
        // seguir intentando
      }

      attempts += 1;
      if (attempts < 12 && !cancelled) {
        window.setTimeout(poll, 2500);
      } else {
        setPolling(false);
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId, product]);

  const premiumReady = Boolean(status?.premiumActive);
  const portalUrl = status?.portalUrl || '/portal-crecimiento';
  const portalEmail = status?.portalEmail;

  return (
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 px-4 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          {pending ? 'Pago en proceso' : premiumReady ? '¡Premium activado!' : 'Pago recibido'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {product === 'plan-conquistar' ? (
            premiumReady ? (
              <>
                Tu Plan Conquistar ya está activo. Te enviamos un email con acceso al portal Premium
                {portalEmail ? (
                  <>
                    {' '}
                    para <strong>{portalEmail}</strong>
                  </>
                ) : null}
                .
              </>
            ) : polling ? (
              'Estamos confirmando tu pago y activando Cleexs Premium…'
            ) : pending ? (
              'Mercado Pago está procesando el pago. Cuando se apruebe, activamos tu Premium y te llega el email de acceso.'
            ) : (
              'Mercado Pago nos notifica la aprobación por webhook. Si el plan no aparece activo al instante, esperá unos segundos y entrá al portal.'
            )
          ) : (
            'Mercado Pago nos va a notificar la aprobación por webhook. Si el plan no aparece activo al instante, esperá unos segundos y volvé al portal.'
          )}
        </p>

        {polling ? (
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-violet-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Activando tu cuenta Premium…
          </div>
        ) : null}

        {portalEmail ? (
          <div className="mx-auto mt-5 flex max-w-md items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-left text-sm text-violet-950">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <p>
              Accedé al portal Premium con tu email <strong>{portalEmail}</strong>. Si es cuenta nueva, la contraseña
              temporal llega en el mismo correo.
            </p>
          </div>
        ) : null}

        <Link
          href={portalUrl}
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Ir al portal Premium
        </Link>
      </section>
    </main>
  );
}

export default function PagoExitoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 px-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <PagoExitoContent />
    </Suspense>
  );
}
