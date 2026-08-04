'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Sparkles } from 'lucide-react';
import { resolveApiBaseUrl } from '@/lib/api-base-url';
import { PaymentStatusScreen } from '@/components/pago/payment-status-screen';

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

  const tone = premiumReady ? 'success' : polling ? 'processing' : pending ? 'pending' : 'success';
  const badge = premiumReady
    ? 'Plan Conquistar'
    : polling
      ? 'Confirmando pago'
      : pending
        ? 'En proceso'
        : 'Pago recibido';
  const title = pending
    ? 'Pago en proceso'
    : premiumReady
      ? '¡Premium activado!'
      : polling
        ? 'Estamos activando tu Premium'
        : 'Pago recibido';

  const description =
    product === 'plan-conquistar' ? (
      premiumReady ? (
        <>
          Tu Plan Conquistar ya está activo. Te enviamos un email con acceso al portal Premium
          {portalEmail ? (
            <>
              {' '}
              para <strong className="font-semibold text-slate-800">{portalEmail}</strong>
            </>
          ) : null}
          .
        </>
      ) : polling ? (
        'Estamos confirmando tu pago con Mercado Pago y activando Cleexs Premium…'
      ) : pending ? (
        'Mercado Pago está procesando el pago. Cuando se apruebe, activamos tu Premium y te llega el email de acceso.'
      ) : (
        'Mercado Pago nos notifica la aprobación por webhook. Si el plan no aparece activo al instante, esperá unos segundos y entrá al portal.'
      )
    ) : (
      'Mercado Pago nos va a notificar la aprobación por webhook. Si el plan no aparece activo al instante, esperá unos segundos y volvé al portal.'
    );

  return (
    <PaymentStatusScreen
      tone={tone}
      badge={badge}
      icon={
        polling ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : premiumReady ? (
          <Sparkles className="h-8 w-8" />
        ) : (
          <CheckCircle2 className="h-8 w-8" />
        )
      }
      title={title}
      description={description}
      primaryHref={portalUrl}
      primaryLabel="Ir al portal Premium"
      secondaryHref="/plan-conquistar"
      secondaryLabel="Ver detalle del plan"
    >
      {polling ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          Activando tu cuenta Premium…
        </div>
      ) : null}

      {portalEmail ? (
        <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white px-4 py-3.5 text-left text-sm text-violet-950">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Mail className="h-4 w-4" />
          </span>
          <p className="leading-relaxed">
            Accedé al portal Premium con tu email{' '}
            <strong className="font-semibold">{portalEmail}</strong>. Si es cuenta nueva, la
            contraseña temporal llega en el mismo correo.
          </p>
        </div>
      ) : null}
    </PaymentStatusScreen>
  );
}

function ExitoFallback() {
  return (
    <PaymentStatusScreen
      tone="processing"
      badge="Cargando"
      icon={<Loader2 className="h-8 w-8 animate-spin" />}
      title="Confirmando tu pago"
      description="Un momento mientras verificamos el estado…"
      primaryHref="/portal-crecimiento"
      primaryLabel="Ir al portal Premium"
    />
  );
}

export default function PagoExitoPage() {
  return (
    <Suspense fallback={<ExitoFallback />}>
      <PagoExitoContent />
    </Suspense>
  );
}
