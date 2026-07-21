'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lightbulb,
  Lock,
  Share2,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticoV2ViewModel } from '@/lib/diagnostico-v2-data';
import type { PublicDiagnostic } from '@/lib/api';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { ShareScoreButtons } from '@/components/share/share-score-buttons';
import {
  PlanConquistarCheckoutButton,
  PlanConquistarPromoPrice,
} from '@/components/planes/plan-conquistar-checkout-button';
import { EnginePaywallModal } from '@/components/diagnostico/engine-paywall-modal';
import type { EngineCardKey } from '@/components/diagnostico/cleexs-engine-scores-panel';

function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function SectionBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e2a5a] text-sm font-bold text-white">
        {n}
      </span>
      <h2 className="text-xl font-bold tracking-tight text-[#1e2a5a] sm:text-2xl">{label}</h2>
    </div>
  );
}

function StarRow({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn('text-lg', i < count ? 'text-amber-400' : 'text-slate-200')}>
          ★
        </span>
      ))}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative mx-auto h-36 w-36 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e8ecf4" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums text-[#1e2a5a]">{score}</span>
        <span className="text-xs font-semibold text-slate-400">/100</span>
      </div>
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: DiagnosticoV2ViewModel['verdict'] }) {
  if (verdict === 'yes') return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />;
  if (verdict === 'partial') return <span className="text-lg leading-none">⚠️</span>;
  return <X className="h-5 w-5 shrink-0 text-rose-500" />;
}

function EngineSidebar({
  score,
  engines,
  onLockedClick,
}: {
  score: number;
  engines: DiagnosticoV2ViewModel['engines'];
  onLockedClick: (key: EngineCardKey) => void;
}) {
  const items: Array<{ key: EngineCardKey; label: string; locked: boolean; value?: number }> = [
    { key: 'chatgpt', label: 'ChatGPT', locked: false, value: score },
    { key: 'gemini', label: 'Gemini', locked: engines.gemini.status === 'locked' },
    { key: 'claude', label: 'Claude', locked: engines.claude.status === 'locked' },
    { key: 'perplexity', label: 'Perplexity', locked: engines.perplexity.status === 'locked' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#1e2a5a]">Tu presencia en los motores</p>
      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const pct = item.value ?? 0;
          return (
            <button
              key={item.key}
              type="button"
              disabled={!item.locked}
              onClick={() => item.locked && onLockedClick(item.key)}
              className={cn('block w-full text-left', item.locked && 'cursor-pointer')}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                {item.locked ? (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <span className="text-xs font-bold tabular-nums text-violet-700">{pct}/100</span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full transition-all', item.locked ? 'w-0' : 'bg-violet-600')}
                  style={{ width: item.locked ? '0%' : `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        Gemini, Claude y Perplexity se desbloquean con Plan Conquistar.
      </p>
    </div>
  );
}

function RevenueCalculator({ leaderName }: { leaderName: string }) {
  const [monthlyVisits, setMonthlyVisits] = useState('500');
  const [conversionRate, setConversionRate] = useState('10');
  const [clientValue, setClientValue] = useState('300');

  const visits = Number(monthlyVisits) || 0;
  const conversion = Number(conversionRate) || 0;
  const value = Number(clientValue) || 0;
  const monthly = visits * (conversion / 100) * value;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="text-lg font-bold text-[#1e2a5a] sm:text-xl">¿Cuánto podrías ganar?</h3>
      <p className="mt-2 text-sm text-slate-600">
        Estimación ilustrativa si implementás las acciones del plan y mejorás tu visibilidad frente a{' '}
        {leaderName}.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Visitas adicionales por mes', value: monthlyVisits, set: setMonthlyVisits },
          { label: 'Conversión a cliente (%)', value: conversionRate, set: setConversionRate },
          { label: 'Facturación mensual por cliente (USD)', value: clientValue, set: setClientValue },
        ].map((field) => (
          <label key={field.label} className="block">
            <span className="text-xs font-semibold text-slate-500">{field.label}</span>
            <input
              type="number"
              min="0"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-xl bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado estimado</p>
        <p className="mt-1 text-3xl font-black text-[#2563eb]">{money(monthly)}</p>
        <p className="mt-1 text-sm font-medium text-slate-600">de facturación adicional mensual</p>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Estimación basada en tus supuestos. No es una promesa de resultados — sirve para dimensionar la
          oportunidad.
        </p>
      </div>
    </div>
  );
}

function DeliverableCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center shadow-sm">
      <div className="mb-3 text-violet-600">{icon}</div>
      <p className="text-3xl font-black tabular-nums text-[#1e2a5a]">{value}</p>
      <p className="mt-2 text-xs leading-snug text-slate-600">{label}</p>
    </div>
  );
}

export function DiagnosticoGratuitoV2({
  diagnostic,
  model,
  sharePath,
}: {
  diagnostic: PublicDiagnostic;
  model: DiagnosticoV2ViewModel;
  sharePath: string;
}) {
  const [paywallEngine, setPaywallEngine] = useState<EngineCardKey | null>(null);

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      {/* Header sticky */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="https://cleexs.net" className="inline-flex items-center gap-2">
            <CleexsMark className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="https://cleexs.net"
              className="hidden text-xs font-medium text-slate-500 hover:text-slate-800 sm:inline"
            >
              ¿Cómo funciona este diagnóstico?
            </Link>
            <ShareScoreButtons
              path={sharePath}
              brandName={model.brandName}
              domain={model.domain}
              diagnosticId={diagnostic.id}
              shareSlug={diagnostic.shareSlug ?? undefined}
              intent="social"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* HERO */}
        <section className="mb-16 sm:mb-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Diagnóstico gratuito</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight tracking-tight text-[#1e2a5a] sm:text-4xl lg:text-[2.65rem]">
            ¿Hoy ChatGPT recomienda tu empresa?
          </h1>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ScoreRing score={model.score} />
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex items-start gap-2">
                  <VerdictIcon verdict={model.verdict} />
                  <p className="text-lg font-bold text-slate-800">{model.verdictLabel}</p>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{model.verdictDetail}</p>
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 ring-1 ring-violet-100">
                  <Trophy className="h-4 w-4" />#{model.brandRank} de {model.competitorCount} competidores analizados
                </div>
              </div>
            </div>
            <EngineSidebar
              score={model.score}
              engines={model.engines}
              onLockedClick={setPaywallEngine}
            />
          </div>
        </section>

        {/* 1 — Hallazgos */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={1} label="Esto explica tu resultado" />
          <div className="grid gap-4 md:grid-cols-3">
            {model.findings.map((f) => (
              <div
                key={f.title}
                className={cn(
                  'rounded-2xl border p-5 shadow-sm',
                  f.tone === 'success' && 'border-emerald-200 bg-emerald-50/60',
                  f.tone === 'warning' && 'border-amber-200 bg-amber-50/60',
                  f.tone === 'critical' && 'border-rose-200 bg-rose-50/60',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-bold',
                    f.tone === 'success' && 'text-emerald-800',
                    f.tone === 'warning' && 'text-amber-900',
                    f.tone === 'critical' && 'text-rose-800',
                  )}
                >
                  {f.tone === 'success' ? '✔' : f.tone === 'warning' ? '⚠' : '✕'} {f.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2 — Competidores */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={2} label="Dónde perdés clientes hoy" />
          <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="mb-6 text-sm font-semibold text-slate-500">
                Participación en respuestas de ChatGPT
              </p>
              <div className="space-y-4">
                {model.competitors.map((row) => (
                  <div key={row.name}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span
                        className={cn(
                          'font-semibold',
                          row.isBrand ? 'text-violet-700' : 'text-slate-700',
                        )}
                      >
                        {row.isBrand ? `${row.name} (vos)` : row.name}
                      </span>
                      <span className="tabular-nums text-slate-500">{row.share.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          row.isBrand ? 'bg-violet-600' : 'bg-slate-400',
                        )}
                        style={{ width: `${Math.max(row.share, row.isBrand ? 4 : 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-blue-100 bg-blue-50/80 p-5">
              <Trophy className="mb-3 h-8 w-8 text-blue-600" />
              <p className="text-sm font-bold text-[#1e2a5a]">Estás muy cerca del líder</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {model.leaderName} lidera con {model.leaderShare.toFixed(1)}%. Con los cambios correctos podés
                ser la primera recomendación en consultas clave.
              </p>
            </div>
          </div>
        </section>

        {/* 3 — Una acción */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={3} label="Si solo pudieras hacer UNA cosa" />
          <div className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/80 to-white shadow-md">
            <div className="border-b border-violet-100 bg-violet-600/5 px-6 py-4">
              <div className="flex items-center gap-2 text-violet-700">
                <Target className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wide">Tu primera misión</span>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <h3 className="text-xl font-bold leading-snug text-[#1e2a5a] sm:text-2xl">
                {model.primaryAction.title}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                {model.primaryAction.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-8">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Impacto esperado</p>
                  <StarRow count={model.primaryAction.impactStars} />
                  <p className="mt-1 text-sm font-bold text-slate-800">{model.primaryAction.impactLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Esfuerzo estimado</p>
                  <StarRow count={model.primaryAction.effortStars} />
                  <p className="mt-1 text-sm font-bold text-slate-800">{model.primaryAction.effortLabel}</p>
                </div>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                Esta acción sola podría cerrar ~{model.gapClosePct}% de la brecha con {model.leaderName}.
              </p>
            </div>
          </div>
        </section>

        {/* 4 — Qué pasa si lo hacés */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={4} label="¿Qué pasaría si lo hacés?" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: <TrendingUp className="h-6 w-6" />, text: 'Más presencia en consultas de decisión' },
              { icon: <Users className="h-6 w-6" />, text: 'Mayor probabilidad de ser la recomendación #1' },
              { icon: <Sparkles className="h-6 w-6" />, text: 'Más confianza cuando comparan opciones' },
            ].map((item) => (
              <div
                key={item.text}
                className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center shadow-sm"
              >
                <div className="mb-3 text-violet-600">{item.icon}</div>
                <p className="text-sm font-semibold text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="text-sm font-bold text-emerald-800">
              Más visibilidad + más confianza = más clientes desde ChatGPT
            </p>
          </div>
        </section>

        {/* Calculadora — fin del diagnóstico free */}
        <section className="mb-20">
          <RevenueCalculator leaderName={model.leaderName} />
          <p className="mt-6 text-center text-sm font-medium text-slate-600">
            Ya entendiste el problema y viste el tamaño de la oportunidad. Ahora te mostramos exactamente cómo
            resolverlo.
          </p>
        </section>

        {/* Corte — Plan Conquistar */}
        <div className="mb-10 border-t border-slate-200 pt-10" />

        {/* 5 — Buenas noticias */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={5} label="Buenas noticias" />
          <p className="mb-6 max-w-2xl text-lg font-semibold text-[#1e2a5a]">
            No necesitás rehacer tu sitio web.
          </p>
          <p className="mb-8 max-w-2xl text-sm leading-relaxed text-slate-600">
            Encontramos una oportunidad muy clara para que ChatGPT te recomiende más seguido. El Plan Conquistar
            convierte ese diagnóstico en un plan de ejecución personalizado.
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-[#1e2a5a]">Tu roadmap personalizado (preview)</p>
              <div className="mt-4 space-y-3">
                {model.roadmapPreview.map((item) => (
                  <div
                    key={item.week}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-violet-700">{item.week}</p>
                      <p className="text-sm text-slate-600">{item.task}</p>
                    </div>
                    <Lock className="h-4 w-4 shrink-0 text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <p className="rotate-0 text-center font-serif text-2xl italic text-violet-400 lg:-rotate-6">
                Esto es solo el comienzo
              </p>
            </div>
          </div>
        </section>

        {/* 6 — Mientras leías */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={6} label="Mientras vos leías este diagnóstico…" />
          <div className="mb-8 max-w-3xl space-y-3">
            <p className="text-base font-semibold text-[#1e2a5a]">
              Nuestro motor terminó de trabajar sobre {model.brandName}.
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Ya analizó todas las oportunidades. Ya calculó cuáles tienen mayor impacto. Ya descartó las que hoy
              no mueven la aguja. Y ya armó un plan de ejecución personalizado para que sepas exactamente qué hacer
              primero.
            </p>
            <p className="text-sm font-bold text-violet-700">Todo ya está listo. Solo falta activarlo.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <DeliverableCard
              icon={<ClipboardList className="h-7 w-7" />}
              value={model.deliverables[0].value}
              label={model.deliverables[0].label}
            />
            <DeliverableCard
              icon={<Lightbulb className="h-7 w-7" />}
              value={model.deliverables[1].value}
              label={model.deliverables[1].label}
            />
            <DeliverableCard
              icon={<FileText className="h-7 w-7" />}
              value={model.deliverables[2].value}
              label={model.deliverables[2].label}
            />
            <DeliverableCard
              icon={<Users className="h-7 w-7" />}
              value={model.deliverables[3].value}
              label={model.deliverables[3].label}
            />
            <DeliverableCard
              icon={<Zap className="h-7 w-7" />}
              value={model.deliverables[4].value}
              label={model.deliverables[4].label}
            />
            <DeliverableCard
              icon={<Target className="h-7 w-7" />}
              value={model.deliverables[5].value}
              label={model.deliverables[5].label}
            />
          </div>
        </section>

        {/* Footer CTA */}
        <section className="overflow-hidden rounded-3xl bg-[#1e2a5a] text-white shadow-2xl">
          <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Plan Conquistar</p>
              <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                Desbloqueá tu plan personalizado para conseguir clientes desde ChatGPT
              </h2>
              <ul className="mt-6 space-y-2.5">
                {[
                  'Roadmap de implementación de 90 días',
                  '25 acciones priorizadas por impacto',
                  'Qué hacer esta semana y qué puede esperar',
                  'Prompts listos para copiar y ejecutar',
                  'Cómo cerrar la brecha con tu competidor líder',
                  'Premium incluido durante la implementación',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 space-y-2 border-t border-white/10 pt-6">
                <p className="text-lg font-bold">El diagnóstico te mostró dónde está la oportunidad.</p>
                <p className="text-sm text-slate-300">
                  El Plan Conquistar te muestra exactamente cómo capturarla.
                </p>
                <p className="text-sm font-semibold text-white/90">
                  Mientras vos intentabas entender qué hacer… nosotros ya lo resolvimos.
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
              <PlanConquistarPromoPrice size="md" className="justify-center" />
              <PlanConquistarCheckoutButton
                className="mt-5 w-full"
                variant="promo"
                label="Quiero mi plan de acción"
                sourceChannel="ver_resultado_v2"
                diagnosticId={diagnostic.id}
                customerEmail={diagnostic.email}
                icon="sparkles"
              />
              <p className="mt-4 text-center text-[11px] text-slate-500">Pago único · Acceso inmediato</p>
            </div>
          </div>
        </section>

        {/* Share footer */}
        <footer className="mt-10 flex flex-col items-center gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:justify-between">
          <ShareScoreButtons
            path={sharePath}
            brandName={model.brandName}
            domain={model.domain}
            diagnosticId={diagnostic.id}
            shareSlug={diagnostic.shareSlug ?? undefined}
            intent="team"
          />
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Share2 className="h-3.5 w-3.5" />
            Invitá a tu equipo a ver este diagnóstico
          </p>
        </footer>

        <p className="mt-8 text-center text-[11px] text-slate-400">
          Vista de prueba ·{' '}
          <Link href={`/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`} className="underline">
            Ver informe actual en producción
          </Link>
        </p>
      </main>

      <EnginePaywallModal
        open={paywallEngine != null}
        engineName={
          paywallEngine === 'gemini'
            ? 'Gemini'
            : paywallEngine === 'claude'
              ? 'Claude'
              : paywallEngine === 'perplexity'
                ? 'Perplexity'
                : null
        }
        onClose={() => setPaywallEngine(null)}
      />
    </div>
  );
}
