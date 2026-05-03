'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, Info, Sparkles } from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { PlanPaymentModal } from '@/components/planes/plan-payment-modal';
import { APP_PLANS, getAnnualPrice, type BillingMode, type PlanDefinition } from '@/lib/plans';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = { planKey?: string; planDisplay?: string };

export default function SuscripcionPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [billingMode, setBillingMode] = useState<BillingMode>('monthly');
  const [pagoOpen, setPagoOpen] = useState(false);
  const [planForPago, setPlanForPago] = useState<PlanDefinition['id']>('crecimiento');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let token: string | null = null;
        try { token = sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
        if (!token) { setLoadError('No hay sesión. Volvé al portal e iniciá sesión.'); setLoading(false); return; }
        const res = await fetch(`${API_URL}/api/me/usage`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const data = res.ok ? (await res.json() as UsageResponse) : {};
        if (!cancelled) { setUsage(data); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setLoadError(String(e)); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-rose-700">{loadError}</p>
          <Link href="/portal-crecimiento" className="mt-4 inline-block text-xs font-semibold text-violet-700 hover:underline">
            ← Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen scroll-smooth bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[220px_1fr]">

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-6 w-6" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <Link href={`${basePath}#portal-cliente`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Portal cliente
            </Link>
            <Link href={`${basePath}/comparacion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Comparación
            </Link>
            <Link href={`${basePath}/prompts`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Prompts
            </Link>
            <Link href={`${basePath}/competidores`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Competidores
            </Link>
            <Link href={`${basePath}/historial`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Historial
            </Link>
            <Link href={`${basePath}/reportes`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Reportes
            </Link>
            <Link
              href={`${basePath}/suscripcion`}
              className="block rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900"
            >
              Suscripción
            </Link>
            <Link href={`${basePath}/equipo`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Equipo
            </Link>
            <Link href={`${basePath}/herramientas`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Herramientas
            </Link>
          </nav>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan actual</p>
            <p className="font-semibold text-slate-900">
              {loading ? '…' : (usage?.planDisplay || usage?.planKey || 'Premium')}
            </p>
          </div>
        </aside>

        {/* ── Contenido: Suscripción ──────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Suscripción
                </div>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">
                  Tu plan actual:{' '}
                  <span className="text-violet-700">
                    {loading ? '…' : (usage?.planDisplay || usage?.planKey || 'Premium Mensual')}
                  </span>
                </h1>
                <p className="mt-0.5 text-sm text-slate-600">
                  Potenciá tus resultados con más motores, prompts y competidores. Elegí la opción que mejor se adapte a
                  tus objetivos.
                </p>
              </div>

              {/* Toggle mensual / anual */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setBillingMode('monthly')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      billingMode === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingMode('annual')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      billingMode === 'annual' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Anual (10% off)
                  </button>
                </div>
                {billingMode === 'annual' && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Ahorrá 10% pagando anual
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Cards de planes ──────────────────────────────────── */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {APP_PLANS.map((plan) => {
              const price =
                plan.monthlyPrice == null
                  ? null
                  : billingMode === 'annual'
                    ? getAnnualPrice(plan.monthlyPrice)
                    : plan.monthlyPrice;
              const isCurrent =
                (usage?.planKey === 'crecimiento' && plan.id === 'crecimiento') ||
                (usage?.planKey === 'free' && plan.id === 'free');

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                    plan.highlighted
                      ? 'border-violet-300 ring-2 ring-violet-100'
                      : 'border-slate-200'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute right-3 top-3 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      {plan.badge}
                    </span>
                  )}
                  <p className="text-xl font-bold text-slate-900">{plan.name}</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    {price == null ? (
                      <p className="text-2xl font-bold text-slate-900">Contáctanos</p>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-slate-900">${price}</span>
                        <span className="text-sm text-slate-500">{plan.periodLabel}</span>
                        {billingMode === 'annual' && plan.monthlyPrice ? (
                          <span className="ml-1 text-sm text-slate-400 line-through">${plan.monthlyPrice}</span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{plan.description}</p>

                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {plan.enginesTitle}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {plan.engines.map((e) => (
                        <span
                          key={e}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    disabled={isCurrent || plan.contactOnly}
                    onClick={() => {
                      if (plan.contactOnly) return;
                      setPlanForPago(plan.id);
                      setPagoOpen(true);
                    }}
                    className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      isCurrent
                        ? 'cursor-default bg-slate-100 text-slate-500'
                        : plan.highlighted
                          ? 'bg-violet-600 text-white hover:bg-violet-700'
                          : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {isCurrent ? 'Plan actual' : plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Card upgrade anual (solo si está en mensual) ────── */}
          {billingMode === 'monthly' && (
            <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500">Tu plan actual</p>
                  <p className="text-lg font-bold text-slate-900">
                    {usage?.planDisplay || usage?.planKey || 'Premium Mensual'}
                  </p>
                  <p className="mt-3 text-2xl font-bold text-violet-700">$99 <span className="text-sm font-normal text-slate-500">/mes</span></p>
                </div>
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-800">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Info className="h-3.5 w-3.5" />
                    Pasate a anual y ahorrá 10%
                  </div>
                  <p className="mt-1 text-violet-700">Mismo plan, más valor. Sin cambios en beneficios.</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">Premium Anual</p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        10% OFF
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      $89 <span className="text-xs font-normal text-slate-500">/mes</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      $1.068/año{' '}
                      <span className="text-slate-400 line-through">$1.188/año</span>
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {[
                      'Mismos beneficios que tu plan actual',
                      'Ahorro total de $120 por año',
                      'Cancelá o cambiá de plan cuando quieras',
                      'Facturación anual',
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBillingMode('annual');
                    setPlanForPago('crecimiento');
                    setPagoOpen(true);
                  }}
                  className="mt-4 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Cambiar a plan anual
                </button>
                <p className="mt-2 text-center text-xs text-slate-500">
                  🔒 Cancelá cuando quieras. Sin permanencias.
                </p>
              </div>
            </div>
          )}

          {/* ── Fila de confianza ─────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Con cualquier plan, siempre tenés
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { icon: '🔒', title: 'Datos seguros', sub: 'Tus datos están protegidos con los más altos estándares.' },
                { icon: '✗', title: 'Cancelá cuando quieras', sub: 'Sin permanencias ni cargos ocultos.' },
                { icon: '↗', title: 'Reportes accionables', sub: 'Insights claros para tomar mejores decisiones.' },
                { icon: '💬', title: 'Soporte humano', sub: 'Estamos para ayudarte en cada paso.' },
              ].map((item) => (
                <div key={item.title} className="space-y-1 text-center">
                  <p className="text-2xl">{item.icon}</p>
                  <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                  <p className="text-[11px] text-slate-500">{item.sub}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-sm text-slate-500">
              ¿Necesitás ayuda para elegir?{' '}
              <a href="mailto:hola@cleexs.com" className="font-semibold text-violet-700 hover:underline">
                Hablar con un experto →
              </a>
            </p>
          </div>
        </div>
      </div>

      <PlanPaymentModal
        open={pagoOpen}
        onOpenChange={setPagoOpen}
        planId={planForPago}
        billingMode={billingMode}
        onConfirm={() => setPagoOpen(false)}
      />
    </main>
  );
}
