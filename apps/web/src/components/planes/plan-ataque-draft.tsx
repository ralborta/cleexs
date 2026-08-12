'use client';

import { Suspense, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  Calendar,
  Target,
  Clock,
  TrendingUp,
  ClipboardList,
  Lightbulb,
  FileText,
  Users,
  Zap,
  Sparkles,
  Scale,
  MessageSquare,
  History,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { PlanAtaqueSectionView } from '@/components/planes/plan-ataque-sections';
import { brandAssetsApi, publicDiagnosticApi } from '@/lib/api';
import {
  CLEEXS_FALLBACK,
  accentFromDomain,
  extractAccentFromLogoUrl,
  type BrandAccent,
} from '@/lib/brand-accent-from-logo';
import {
  buildPlanAtaqueDocument,
  type PlanAtaqueDocument,
  type PlanAtaqueSectionId,
} from '@/lib/plan-ataque-document';
import type { PlanConquistarLandingContext } from '@/lib/plan-conquistar-landing-context';
import { cn } from '@/lib/utils';

function portalLinksForRun(runId: string) {
  const base = `/portal-crecimiento/reporte/${runId}/premium`;
  return [
    { href: base, label: 'Informe / Interpretación', Icon: Sparkles },
    { href: `${base}/comparacion`, label: 'Comparación', Icon: Scale },
    { href: `${base}/competidores`, label: 'Competidores', Icon: Target },
    { href: `${base}/prompts`, label: 'Prompts', Icon: MessageSquare },
    { href: `${base}/historial`, label: 'Historial', Icon: History },
    { href: `${base}/visibilidad-global`, label: 'Visibilidad global', Icon: Globe },
    { href: `${base}/reportes`, label: 'Reportes', Icon: FileText },
  ] as const;
}

function impactLabel(ctx: PlanConquistarLandingContext): string {
  const ops = ctx.opportunityCount ?? 0;
  const score = ctx.cleexsScore;
  if (ops >= 20 || (score != null && score < 40)) return 'ALTO';
  if (ops >= 10 || (score != null && score < 60)) return 'MEDIO';
  if (ops > 0 || score != null) return 'MODERADO';
  return '—';
}

function estimatedHours(ctx: PlanConquistarLandingContext): number | null {
  const ops = ctx.opportunityCount;
  if (ops == null || ops <= 0) return null;
  return Math.max(6, Math.round(ops * 0.75));
}

function MetricCard({
  icon: Icon,
  accent,
  iconTone = 'brand',
  primary,
  secondary,
  emphasizePrimary = false,
}: {
  icon: LucideIcon;
  accent: BrandAccent;
  iconTone?: 'brand' | 'ink';
  primary: string;
  secondary: string;
  emphasizePrimary?: boolean;
}) {
  const iconColor = iconTone === 'brand' ? accent.primary : '#0f172a';
  return (
    <div className="flex min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm sm:min-w-[10.5rem] sm:gap-3 sm:px-3.5 sm:py-3">
      <Icon className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" strokeWidth={1.75} style={{ color: iconColor }} />
      <div className="min-w-0 text-left leading-tight">
        <p
          className={cn(
            'truncate text-base font-bold sm:text-lg',
            emphasizePrimary ? '' : 'text-slate-900'
          )}
          style={emphasizePrimary ? { color: accent.primary } : undefined}
        >
          {primary}
        </p>
        <p className="truncate text-[11px] text-slate-600 sm:text-xs">{secondary}</p>
      </div>
    </div>
  );
}

function PlanAtaqueShell({
  doc,
  accent,
  logoUrl,
  unlocked = false,
  diagnosticId,
}: {
  doc: PlanAtaqueDocument;
  accent: BrandAccent;
  logoUrl: string | null;
  unlocked?: boolean;
  diagnosticId: string;
}) {
  const { ctx } = doc;
  const [sectionId, setSectionId] = useState<PlanAtaqueSectionId>(
    unlocked ? 'panel' : 'portada'
  );

  const today = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const actions = ctx.opportunityCount;
  const hours = estimatedHours(ctx);
  const impact = impactLabel(ctx);

  const sectionIndex = useMemo(() => {
    const idx = doc.nav.findIndex((n) => n.id === sectionId);
    return idx >= 0 ? idx + 1 : 1;
  }, [doc.nav, sectionId]);

  const footerStats = useMemo(() => {
    const nAcciones = Math.max(doc.taskList.length, actions ?? ctx.topActions.length, 6);
    const nPrompts = Math.max(
      doc.suggestedContent.length,
      ctx.engines.length * 2,
      ctx.topActions.length,
      4
    );
    const nPaginas = doc.nav.length;
    const nComparativas = Math.max(ctx.competitors.length, 1);
    const nMejoras = Math.max(2, doc.immediatePlan.reduce((n, p) => n + p.tasks.length, 0));
    return [
      { icon: ClipboardList, value: String(nAcciones), label: 'Acciones' },
      { icon: Lightbulb, value: String(nPrompts), label: 'Prompts' },
      { icon: FileText, value: String(nPaginas), label: 'Páginas' },
      { icon: Users, value: String(nComparativas), label: 'Comparativas' },
      { icon: Zap, value: String(nMejoras), label: 'Mejoras' },
      { icon: Target, value: '1', label: 'Plan de acción' },
    ] as Array<{ icon: LucideIcon; value: string; label: string }>;
  }, [doc, actions, ctx.topActions.length, ctx.engines.length, ctx.competitors.length]);

  return (
    <div
      className="min-h-screen bg-white text-slate-900"
      style={
        {
          '--brand': accent.primary,
          '--brand-ink': accent.ink,
          '--brand-soft': accent.soft,
        } as CSSProperties
      }
    >
      {!unlocked ? (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-900">
          Borrador · documento completo navegable · acento {accent.primary} ({accent.source}
          {logoUrl ? '' : ', sin logo'})
        </div>
      ) : (
        <div className="border-b border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-[11px] font-medium text-emerald-900">
          Plan Conquistar activo · Hub de gestión del Plan de Ataque para {ctx.domain}
        </div>
      )}

      <div style={{ backgroundColor: accent.primary }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white sm:px-5 sm:text-[11px]">
          <span className="shrink-0">Confidencial</span>
          <span className="min-w-0 truncate text-center font-medium normal-case tracking-normal opacity-95">
            Preparado exclusivamente para{' '}
            <span className="font-bold">{ctx.domain}</span>
          </span>
          <span className="shrink-0 tracking-normal opacity-95">cleexs</span>
        </div>
      </div>

      <section className="px-4 pb-5 pt-7 text-center sm:px-6 sm:pb-6 sm:pt-9">
        <h1 className="mx-auto max-w-3xl text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-[1.75rem]">
          Ya terminé el plan para{' '}
          <span style={{ color: accent.primary }}>{ctx.domain}</span>
          {ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}
        </h1>

        <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-stretch justify-center gap-2.5 sm:gap-3">
          <MetricCard
            icon={Target}
            accent={accent}
            iconTone="brand"
            primary={actions != null ? String(actions) : '—'}
            secondary="acciones priorizadas"
          />
          <MetricCard
            icon={Clock}
            accent={accent}
            iconTone="ink"
            primary={hours != null ? String(hours) : '—'}
            secondary="horas estimadas"
          />
          <MetricCard
            icon={TrendingUp}
            accent={accent}
            iconTone="brand"
            primary={impact}
            secondary="Impacto esperado"
            emphasizePrimary
          />
          <MetricCard
            icon={Calendar}
            accent={accent}
            iconTone="ink"
            primary="90"
            secondary="días de plan"
          />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="grid lg:grid-cols-[200px_1fr] lg:items-start">
            <aside
              className="flex flex-col text-slate-800 lg:self-start"
              style={{ backgroundColor: '#E9EDF2' }}
            >
              <div className="flex flex-col items-center gap-2 border-b border-slate-200 px-3 py-4 text-center">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <BrandLogo
                    name={ctx.brandName}
                    domain={ctx.domain}
                    size={80}
                    variant="icon"
                    hideIfMissing
                    className="rounded-lg"
                  />
                </div>
                <div className="min-w-0 w-full">
                  <p className="truncate text-sm font-semibold text-slate-900">{ctx.brandName}</p>
                  <p className="truncate text-[11px] text-slate-600">{ctx.domain}</p>
                </div>
              </div>
              <nav className="px-1.5 py-2" aria-label="Índice del plan">
                {(
                  [
                    { key: 'gestionar' as const, title: 'Gestionar el plan' },
                    { key: 'documento' as const, title: 'Documento' },
                  ] as const
                ).map((group) => {
                  const items = doc.nav.filter((n) => n.group === group.key);
                  if (!items.length) return null;
                  return (
                    <div key={group.key} className={group.key === 'documento' ? 'mt-3 border-t border-slate-200/80 pt-2' : ''}>
                      <p className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {group.title}
                      </p>
                      <ul className="space-y-0.5">
                        {items.map((item) => {
                          const active = item.id === sectionId;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => setSectionId(item.id)}
                                className={cn(
                                  'w-full rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors',
                                  active
                                    ? 'font-semibold text-slate-900'
                                    : 'text-slate-700 hover:bg-white/70'
                                )}
                                style={
                                  active
                                    ? {
                                        backgroundColor: '#ffffff',
                                        boxShadow: `inset 2px 0 0 ${accent.primary}`,
                                      }
                                    : undefined
                                }
                              >
                                <span className="truncate">{item.label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}

                {doc.runId ? (
                  <div className="mt-3 border-t border-slate-200/80 pt-2">
                    <p className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Más info en el portal
                    </p>
                    <ul className="space-y-0.5">
                      {portalLinksForRun(doc.runId).map(({ href, label, Icon }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-700 transition-colors hover:bg-white/70"
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                            <span className="truncate">{label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </nav>
              <p className="mt-auto border-t border-slate-200 px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-slate-500">
                cleexs
              </p>
            </aside>

            <div className="relative bg-slate-100">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500">
                <span>{unlocked ? 'Plan completo' : 'Vista previa'}</span>
                <span>
                  {sectionIndex} / {doc.nav.length} · 100%
                </span>
              </div>

              <div className="p-3 sm:p-4">
                <PlanAtaqueSectionView
                  doc={doc}
                  sectionId={sectionId}
                  accent={accent}
                  logoUrl={logoUrl}
                  unlocked={unlocked}
                  today={today}
                  onNavigate={(id) => setSectionId(id as PlanAtaqueSectionId)}
                />
              </div>

              <div
                className="border-t border-slate-200 px-3 py-3 sm:px-4"
                style={{ backgroundColor: '#E1E6EC' }}
              >
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
                  {footerStats.map(({ icon: Icon, value, label }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-white px-2 py-2.5 text-center shadow-sm"
                    >
                      <Icon
                        className="h-5 w-5"
                        strokeWidth={1.75}
                        style={{ color: accent.primary }}
                      />
                      <p className="mt-1 text-lg font-bold leading-none text-slate-900">{value}</p>
                      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                {!unlocked && (
                  <div className="mt-3 flex justify-center">
                    <Link
                      href={`/plan-conquistar?diagnosticId=${encodeURIComponent(diagnosticId)}`}
                      className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
                      style={{ backgroundColor: accent.primary }}
                    >
                      Desbloquear plan completo
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          {unlocked ? (
            <Link href="/portal-crecimiento" className="underline hover:text-slate-700">
              ← Volver al portal Premium
            </Link>
          ) : (
            <Link href="/borrador/plan-conquistar" className="underline hover:text-slate-700">
              ← Landing Plan Conquistar
            </Link>
          )}
          {' · '}
          {ctx.domain}
        </p>
      </div>
    </div>
  );
}

function PlanAtaqueLoader({
  unlocked,
  missingTitle,
  missingBody,
  errorFallback,
  loadingLabel,
}: {
  unlocked: boolean;
  missingTitle: string;
  missingBody: ReactNode;
  errorFallback: string;
  loadingLabel: string;
}) {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [loading, setLoading] = useState(Boolean(diagnosticId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<PlanAtaqueDocument | null>(null);
  const [accent, setAccent] = useState<BrandAccent>(CLEEXS_FALLBACK);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!diagnosticId) {
      setLoading(false);
      setDoc(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    publicDiagnosticApi
      .get(diagnosticId)
      .then(async (diag) => {
        if (cancelled) return;
        const next = buildPlanAtaqueDocument(diag);
        setDoc(next);

        let resolvedLogo: string | null = null;
        try {
          const asset = await brandAssetsApi.resolve({
            domain: next.ctx.domain,
            brandName: next.ctx.brandName,
          });
          if (asset.status === 'ok' && asset.logoUrl && !asset.logoUrl.includes('brandfetch.io')) {
            resolvedLogo = asset.logoUrl;
          }
        } catch {
          // ignore
        }
        if (cancelled) return;
        setLogoUrl(resolvedLogo);

        if (resolvedLogo) {
          const fromLogo = await extractAccentFromLogoUrl(resolvedLogo, next.ctx.domain);
          if (!cancelled) setAccent(fromLogo);
        } else {
          setAccent(accentFromDomain(next.ctx.domain));
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(errorFallback);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [diagnosticId, errorFallback]);

  if (!diagnosticId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-medium text-amber-800">{missingTitle}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Falta diagnosticId</h1>
        <div className="mt-2 text-slate-600">{missingBody}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        {loadingLabel}
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{loadError || 'Sin datos'}</p>
      </div>
    );
  }

  return (
    <PlanAtaqueShell
      doc={doc}
      accent={accent}
      logoUrl={logoUrl}
      unlocked={unlocked}
      diagnosticId={diagnosticId}
    />
  );
}

function PlanAtaqueDraftInner() {
  return (
    <PlanAtaqueLoader
      unlocked={false}
      missingTitle="Borrador · Plan de Ataque"
      missingBody={
        <p>
          Agregá <code className="rounded bg-slate-100 px-1 text-sm">?diagnosticId=…</code>
        </p>
      }
      errorFallback="No pudimos cargar ese diagnóstico. Revisá el diagnosticId."
      loadingLabel="Cargando borrador…"
    />
  );
}

function PlanAtaqueUnlockedInner() {
  return (
    <PlanAtaqueLoader
      unlocked
      missingTitle="Plan de Ataque"
      missingBody={
        <>
          <p>Falta el diagnóstico asociado a tu compra.</p>
          <Link href="/portal-crecimiento" className="mt-4 inline-block text-violet-700 underline">
            Ir al portal Premium
          </Link>
        </>
      }
      errorFallback="No pudimos cargar tu Plan de Ataque. Revisá el enlace del email."
      loadingLabel="Cargando tu Plan de Ataque…"
    />
  );
}

export function PlanAtaqueDraft() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      }
    >
      <PlanAtaqueDraftInner />
    </Suspense>
  );
}

/** Vista post-compra (Premium / Plan Conquistar). */
export function PlanAtaqueUnlocked() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando tu Plan de Ataque…
        </div>
      }
    >
      <PlanAtaqueUnlockedInner />
    </Suspense>
  );
}
