'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
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
  const isPlanConquistar = product === 'plan-conquistar';
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [polling, setPolling] = useState(Boolean(paymentId && isPlanConquistar));

  useEffect(() => {
    if (!paymentId || !isPlanConquistar) return;

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
  }, [paymentId, isPlanConquistar]);

  const planReady = Boolean(status?.premiumActive) || (!polling && !pending && isPlanConquistar && status?.status === 'approved');
  const planAtaqueUrl = status?.portalUrl || '/portal-crecimiento/plan-ataque';
  const portalUrl = status?.portalUrl || '/portal-crecimiento';

  const tone = planReady || (!isPlanConquistar && !polling && !pending)
    ? 'success'
    : polling
      ? 'processing'
      : pending
        ? 'pending'
        : 'success';

  const badge = isPlanConquistar
    ? planReady
      ? 'Plan Conquistar'
      : polling
        ? 'Confirmando pago'
        : pending
          ? 'En proceso'
          : 'Pago recibido'
    : pending
      ? 'En proceso'
      : 'Pago recibido';

  const title = isPlanConquistar
    ? pending
      ? 'Pago en proceso'
      : planReady
        ? 'Plan Conquistar Activado'
        : polling
          ? 'Estamos activando tu Plan Conquistar'
          : 'Pago recibido'
    : pending
      ? 'Pago en proceso'
      : 'Pago recibido';

  const description = isPlanConquistar ? (
    planReady ? (
      'Tu Plan Conquistar ya está activo y tu Plan de Ataque quedó listo.'
    ) : polling ? (
      'Estamos confirmando tu pago con Mercado Pago y activando tu Plan Conquistar…'
    ) : pending ? (
      'Mercado Pago está procesando el pago. Cuando se apruebe, activamos tu Plan Conquistar.'
    ) : (
      'Mercado Pago nos notifica la aprobación por webhook. Si el plan no aparece activo al instante, esperá unos segundos.'
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
        ) : planReady || !isPlanConquistar ? (
          <Sparkles className="h-8 w-8" />
        ) : (
          <CheckCircle2 className="h-8 w-8" />
        )
      }
      title={title}
      description={description}
      primaryHref={isPlanConquistar ? planAtaqueUrl : portalUrl}
      primaryLabel={isPlanConquistar ? 'Ver mi Plan de Ataque' : 'Ir al portal'}
      secondaryHref={isPlanConquistar ? undefined : '/plan-conquistar'}
      secondaryLabel={isPlanConquistar ? undefined : 'Ver detalle del plan'}
    >
      {polling ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          Activando tu Plan Conquistar…
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
      primaryHref="/portal-crecimiento/plan-ataque"
      primaryLabel="Ver mi Plan de Ataque"
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
