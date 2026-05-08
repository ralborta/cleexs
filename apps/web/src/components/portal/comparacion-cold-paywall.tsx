'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  Crosshair,
  Crown,
  Download,
  Gauge,
  GitCompareArrows,
  Info,
  Lightbulb,
  LineChart,
  ListChecks,
  Lock,
  Medal,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { PortalCrecimientoTierNav } from '@/components/portal/portal-crecimiento-tier-nav';
import { PortalFreeTierNav } from '@/components/portal/portal-free-tier-nav';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

function isPremiumPlan(planKey?: string) {
  return planKey === 'crecimiento' || planKey === 'enterprise';
}

function isFreePortalPlan(planKey?: string) {
  return planKey === 'free' || planKey === 'anonymous' || !planKey;
}

function nextRenewalLabel() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return next.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function TrendLineStatic() {
  return (
    <svg viewBox="0 0 180 56" className="w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="cold-tl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M 2 18 L 48 32 L 92 24 L 134 40 L 178 28 L 178 56 L 2 56 Z"
        fill="url(#cold-tl)"
      />
      <path
        d="M 2 18 L 48 32 L 92 24 L 134 40 L 178 28"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DonutStatic() {
  const r = 40;
  const cx = 60;
  const cy = 60;
  const circ = 2 * Math.PI * r;
  const segs = [
    { c: '#7c3aed', p: 0.78 },
    { c: '#60a5fa', p: 0.11 },
    { c: '#f87171', p: 0.11 },
  ];
  let off = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" aria-hidden>
      {segs.map((s, i) => {
        const dash = s.p * circ;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.c}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-off}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        off += dash;
        return el;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">
        9
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="#64748b">
        intenciones
      </text>
    </svg>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  subClass,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100">
          <Icon className="h-3 w-3 text-violet-700" />
        </span>
        <p className="text-[9px] font-semibold leading-tight text-slate-500">{label}</p>
      </div>
      <p className="mt-1 text-lg font-bold leading-none text-slate-900">{value}</p>
      {sub ? <p className={`mt-0.5 text-[9px] ${subClass ?? 'text-slate-500'}`}>{sub}</p> : null}
    </div>
  );
}

export type ComparacionColdPaywallShell = 'portal-cliente' | 'portal-crecimiento';

export function ComparacionColdPaywallPage({
  shell,
  pageContext = 'comparacion',
}: {
  shell: ComparacionColdPaywallShell;
  /** Misma pantalla de upsell; título de fondo distinto para Competidores vs Comparación */
  pageContext?: 'comparacion' | 'competidores';
}) {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          setLoadError(
            shell === 'portal-cliente'
              ? 'No hay sesión. Entrá desde /portal-cliente e iniciá sesión.'
              : 'No hay sesión. Entrá desde /portal-crecimiento e iniciá sesión.',
          );
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const data = res.ok ? ((await res.json()) as UsageResponse) : {};
        if (!cancelled) {
          setUsage(data);
          if (isPremiumPlan(data.planKey)) {
            const premiumTarget =
              pageContext === 'competidores'
                ? `/portal-crecimiento/reporte/${runId}/premium/competidores`
                : `/portal-crecimiento/reporte/${runId}/premium/comparacion`;
            router.replace(premiumTarget);
            return;
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, router, shell, pageContext]);

  const analysesUsed = usage?.usage?.scoreViews ?? 0;
  const analysesLimitRaw = usage?.limits?.scoreViews;
  const analysesLimitForNav = analysesLimitRaw ?? 2;

  const base =
    shell === 'portal-cliente'
      ? `/portal-cliente/reporte/${runId}`
      : `/portal-crecimiento/reporte/${runId}/cliente`;

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md space-y-4 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-rose-800">{loadError}</p>
          <Link
            href={shell === 'portal-cliente' ? '/portal-cliente' : '/portal-crecimiento'}
            className="inline-block text-sm font-semibold text-violet-700 hover:underline"
          >
            ← Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando…</p>
      </main>
    );
  }

  if (!isFreePortalPlan(usage?.planKey)) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">
          {pageContext === 'competidores' ? 'Redirigiendo a Competidores Premium…' : 'Redirigiendo a Comparación Premium…'}
        </p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden scroll-smooth bg-slate-50 p-3 sm:p-5">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-slate-50"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center opacity-[0.05]"
        style={{ backgroundImage: 'url(/verificando-hero.png)' }}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-slate-50/80 via-slate-50/70 to-slate-100/90" aria-hidden />

      <div className="relative z-[1] mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        {shell === 'portal-cliente' ? (
          <PortalFreeTierNav
            basePath={base}
            analysesUsed={analysesUsed}
            analysesLimit={analysesLimitForNav}
            renewalLabel={nextRenewalLabel()}
          />
        ) : (
          <PortalCrecimientoTierNav
            basePath={base}
            runId={runId}
            planLabel={usage?.planDisplay || usage?.planKey || 'Free'}
            analysesUsed={analysesUsed}
            analysesLimit={analysesLimitForNav}
            renewalLabel={nextRenewalLabel()}
          />
        )}

        <div className="relative min-w-0 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-base font-bold text-slate-900 sm:text-lg">
                  {pageContext === 'competidores' ? 'Competidores' : 'Comparación'}
                </h1>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  {pageContext === 'competidores'
                    ? 'Cleexs Score del panel, ranking y visibilidad en Top 3 frente a competidores en esta corrida.'
                    : 'Evolución frente a tu última corrida con score y posición relativa frente al grupo.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700">
                  <CalendarDays className="h-3 w-3 text-slate-400" />
                  Última corrida: 28/04/2099
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700">
                  <GitCompareArrows className="h-3 w-3 text-slate-400" />
                  Comparar con: 28/04/2099
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[9px] font-semibold text-slate-500">Corrida actual</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">86</p>
              <p className="mt-1 text-[9px] text-slate-400">28/04/2099, 00:00</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[9px] font-semibold text-slate-500">Corrida anterior</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">86</p>
              <p className="mt-1 text-[9px] text-slate-400">27/04/2099, 00:00</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[9px] font-semibold text-slate-500">Diferencia</p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">0</p>
              <p className="mt-1 text-[9px] text-slate-400">0% vs corrida anterior</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1">
                <p className="text-[9px] font-semibold text-slate-500">Tendencia (3 corridas)</p>
                <Info className="h-3 w-3 text-slate-300" />
              </div>
              <div className="mt-1 h-12">
                <TrendLineStatic />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
            <MetricTile icon={Gauge} label="Cleexs Score" value="86" sub="Nivel excelente" subClass="text-emerald-600" />
            <MetricTile icon={Medal} label="Ranking" value="#1" sub="de 1 marcas" />
            <MetricTile icon={ListChecks} label="Reportes generados" value="5" sub="Historial total" />
            <MetricTile icon={BarChart3} label="Promedio desempeño" value="86%" sub="Sobre todas las intenciones" />
            <MetricTile icon={LineChart} label="Brecha vs líder" value="—" sub="Sin datos" />
            <MetricTile icon={Rocket} label="Mejor intención" value="General" sub="86% de aparición" />
            <MetricTile icon={Zap} label="Intenciones evaluadas" value="9" sub="1 categorías" />
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-1">
                <p className="text-xs font-bold text-slate-900">Ranking del panel</p>
                <Info className="h-3 w-3 text-slate-300" />
              </div>
              <table className="w-full min-w-[240px] text-[10px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="pb-1.5 text-left">#</th>
                    <th className="pb-1.5 text-left">Marca</th>
                    <th className="pb-1.5 text-right">Score actual</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-50">
                    <td className="py-1.5 font-medium text-slate-600">1</td>
                    <td className="py-1.5">
                      <span className="font-medium text-violet-700">Marca Demo (Tú)</span>
                      <span className="ml-1 rounded-full bg-violet-100 px-1 py-px text-[8px] font-semibold text-violet-800">
                        Tu marca
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-bold text-slate-900">86</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-[10px] font-semibold text-violet-700">Ver ranking histórico completo →</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-1">
                <p className="text-xs font-bold text-slate-900">Distribución de scores</p>
                <Info className="h-3 w-3 text-slate-300" />
              </div>
              <div className="text-[10px]">
                <div className="mb-1 flex justify-between font-medium text-violet-700">
                  <span>Marca Demo (Tú)</span>
                  <span>86</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[86%] rounded-full bg-violet-500" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-1">
                <p className="text-xs font-bold text-slate-900">Intenciones por desempeño</p>
                <Info className="h-3 w-3 text-slate-300" />
              </div>
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                <DonutStatic />
                <ul className="space-y-1 text-[10px]">
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                    <span className="text-slate-600">Excelente (80-100)</span>
                    <span className="ml-auto font-bold">7 (78%)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                    <span className="text-slate-600">Bueno (60-79)</span>
                    <span className="ml-auto font-bold">1 (11%)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
                    <span className="text-slate-600">Bajo (0-39)</span>
                    <span className="ml-auto font-bold">1 (11%)</span>
                  </li>
                </ul>
              </div>
              <p className="mt-2 text-[10px] font-semibold text-violet-700">Ver detalle por intención →</p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="mb-2 text-xs font-bold text-slate-900">Insights principales</p>
              <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                  <Star className="h-3.5 w-3.5 text-violet-700" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-900">
                    Sos líder del grupo por posición actual.
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Mantené tu ventaja frente a la competencia.</p>
                </div>
                <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-px text-[9px] font-semibold text-violet-800">
                  Destacado
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                  <Users className="h-4 w-4 text-violet-700" />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-900">Profundizá en la comparación</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Accedé al informe completo con Top 3, funnel y anexo por prompt.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400">
            <Link href={base} className="text-violet-600 hover:underline">
              ← Volver al resumen
            </Link>
          </p>
        </div>
      </div>

      <div className="fixed inset-0 z-40 bg-slate-900/55 backdrop-blur-[2px]" aria-hidden />

      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div className="relative my-4 w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white shadow-2xl sm:my-0 sm:max-w-xl">
          <Link
            href={base}
            className="absolute right-3 top-3 z-10 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Link>

          <div className="px-5 pb-4 pt-8 text-center sm:px-7 sm:pt-9">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
              <Sparkles className="h-6 w-6 text-violet-600" />
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-900 sm:text-lg">
              Esta vista completa está disponible en <span className="text-violet-600">Premium</span>
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-slate-500">
              Desbloqueá todo el potencial de Cleexs y accedé al análisis completo para entender qué impulsa tu score y
              cómo superás a tus competidores.
            </p>
          </div>

          <div className="border-t border-slate-100 px-5 py-4 sm:px-7">
            <ul className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    Icon: LineChart,
                    t: 'Ranking histórico completo',
                    d: 'Evolución detallada corrida a corrida.',
                  },
                  {
                    Icon: Lightbulb,
                    t: 'Recomendaciones accionables',
                    d: 'Insights específicos para mejorar tu visibilidad en IA.',
                  },
                  {
                    Icon: ListChecks,
                    t: 'Detalle por intención y prompt',
                    d: 'Top 3 por prompt, aparición y posición.',
                  },
                  {
                    Icon: Download,
                    t: 'Exportación de reportes',
                    d: 'Descargá informes completos en PDF y CSV.',
                  },
                  {
                    Icon: Crosshair,
                    t: 'Brecha vs líder',
                    d: 'Comparación profunda por intención y por prompt.',
                  },
                  {
                    Icon: Bell,
                    t: 'Alertas y seguimiento',
                    d: 'Recibí notificaciones y monitoreá el progreso automáticamente.',
                  },
                ] as const
              ).map(({ Icon, t, d }) => (
                <li key={t} className="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                    <Icon className="h-4 w-4 text-violet-700" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-900">{t}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-b-2xl bg-violet-50/90 px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <p className="text-[11px] leading-snug text-violet-950">
                  <span className="font-bold">Más datos. Mejores decisiones.</span>{' '}
                  Unite a las marcas que ya están liderando en las recomendaciones de IA.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch sm:items-end">
                <Link
                  href="/planes"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Actualizar mi plan
                </Link>
                <span className="mt-1.5 text-center text-[9px] text-violet-800/80 sm:text-right">Cancelá cuando quieras</span>
              </div>
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">
            <Lock className="h-3 w-3 shrink-0 text-slate-400" />
            Tu plan actual es Free. Actualizá para desbloquear{' '}
            {pageContext === 'competidores' ? 'el análisis completo de competidores' : 'esta vista completa'}.
          </p>
        </div>
      </div>
    </main>
  );
}
