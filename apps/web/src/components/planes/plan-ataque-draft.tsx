'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { brandAssetsApi, publicDiagnosticApi } from '@/lib/api';
import {
  CLEEXS_FALLBACK,
  accentFromDomain,
  extractAccentFromLogoUrl,
  type BrandAccent,
} from '@/lib/brand-accent-from-logo';
import {
  buildPlanConquistarLandingContext,
  type PlanConquistarLandingContext,
} from '@/lib/plan-conquistar-landing-context';
import { cn } from '@/lib/utils';

/**
 * Shell visual del “Plan de Ataque” (borrador).
 * - Menú / opciones: NO funcionales (solo maqueta).
 * - Color de marca: líneas + títulos desde el logo.
 */

const SIDEBAR_ITEMS: Array<{ label: string; locked: boolean; active?: boolean }> = [
  { label: 'Portada', locked: false },
  { label: 'Índice', locked: false },
  { label: '★ Prioridad #1', locked: false, active: true },
  { label: 'Competidores', locked: true },
  { label: 'Preguntas perdidas', locked: true },
  { label: 'Quick Wins', locked: true },
  { label: 'Contenido recomendado', locked: true },
  { label: 'Schema & datos', locked: true },
  { label: 'Roadmap 90 días', locked: true },
  { label: 'Calendario', locked: true },
  { label: 'Checklist', locked: true },
  { label: 'IA Overview', locked: true },
  { label: 'FAQ', locked: true },
  { label: 'Recursos', locked: true },
];

function AccentLine({ accent, className }: { accent: BrandAccent; className?: string }) {
  return (
    <div
      className={cn('h-1 w-full rounded-full', className)}
      style={{ backgroundColor: accent.primary }}
      aria-hidden
    />
  );
}

function PlanAtaqueShell({
  ctx,
  accent,
  logoUrl,
}: {
  ctx: PlanConquistarLandingContext;
  accent: BrandAccent;
  logoUrl: string | null;
}) {
  const today = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const faqs = [
    `¿Cómo elegir ${ctx.brandName} frente a alternativas?`,
    ctx.competitors[0]
      ? `¿Por qué ${ctx.brandName} aparece menos que ${ctx.competitors[0].name} en ChatGPT?`
      : `¿Dónde encontrar información confiable de ${ctx.brandName}?`,
    ctx.industry
      ? `¿Qué ofrece ${ctx.brandName} en ${ctx.industry}?`
      : `¿Qué servicios ofrece ${ctx.brandName}?`,
    `¿Cómo contactar o comprar en ${ctx.domain}?`,
  ];

  return (
    <div
      className="min-h-screen bg-slate-100 text-slate-900"
      style={
        {
          '--brand': accent.primary,
          '--brand-ink': accent.ink,
          '--brand-soft': accent.soft,
        } as React.CSSProperties
      }
    >
      {/* Banner borrador */}
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
        Borrador · Plan de Ataque · menú y opciones aún no funcionan · acento{' '}
        <span className="font-mono">{accent.primary}</span> ({accent.source}
        {logoUrl ? '' : ', sin logo'})
      </div>

      {/* Barra confidencial con línea de marca */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white sm:px-6 sm:text-xs"
        style={{ backgroundColor: accent.ink }}
      >
        <span>Confidencial</span>
        <span className="truncate text-center font-medium normal-case tracking-normal opacity-95">
          Preparado exclusivamente para {ctx.domain}
        </span>
        <span className="shrink-0 tracking-normal text-white/90">cleexs</span>
      </div>
      <AccentLine accent={accent} className="rounded-none" />

      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
        {/* Hero copy */}
        <header className="mb-6 sm:mb-8">
          <p className="text-sm font-medium text-slate-500">Borrador visual</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Ya terminé el plan para{' '}
            <span style={{ color: accent.ink }}>{ctx.domain}</span>
            {ctx.brandName && ctx.brandName.toLowerCase() !== ctx.domain.toLowerCase() ? (
              <span className="text-slate-500"> · {ctx.brandName}</span>
            ) : null}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
            Esto no es un reporte genérico: es un plan de ejecución a medida. El menú de la
            izquierda es maqueta (todavía no navega).
          </p>

          {/* Stats decorativos — números placeholder, no reales */}
          <div className="mt-5 flex flex-wrap gap-3 sm:gap-4">
            {[
              { value: '—', label: 'acciones' },
              { value: '—', label: 'horas est.' },
              { value: '—', label: 'impacto' },
              { value: '90', label: 'días roadmap' },
            ].map((s) => (
              <div
                key={s.label}
                className="min-w-[4.5rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm"
              >
                <p className="text-lg font-bold sm:text-xl" style={{ color: accent.ink }}>
                  {s.value}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </header>

        {/* Layout: sidebar + documento */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="grid lg:grid-cols-[220px_1fr]">
            {/* Sidebar — no funcional */}
            <aside className="border-b border-slate-200 bg-slate-900 text-slate-200 lg:border-b-0 lg:border-r lg:border-slate-800">
              <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-4">
                <BrandLogo
                  name={ctx.brandName}
                  domain={ctx.domain}
                  size={36}
                  variant="icon"
                  hideIfMissing
                  className="rounded-lg"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{ctx.brandName}</p>
                  <p className="truncate text-[11px] text-slate-400">{ctx.domain}</p>
                </div>
              </div>
              <nav className="px-2 py-3" aria-label="Índice del plan (maqueta)">
                <ul className="space-y-0.5">
                  {SIDEBAR_ITEMS.map((item) => (
                    <li key={item.label}>
                      <button
                        type="button"
                        disabled
                        title="Aún no funcional"
                        className={cn(
                          'flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px]',
                          item.active
                            ? 'bg-white/10 font-semibold text-white'
                            : 'text-slate-400'
                        )}
                        style={
                          item.active
                            ? { boxShadow: `inset 3px 0 0 ${accent.primary}` }
                            : undefined
                        }
                      >
                        <span className="truncate">{item.label}</span>
                        {item.locked ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-500"
                >
                  <Lock className="h-3.5 w-3.5" />
                  + páginas más
                </button>
              </nav>
            </aside>

            {/* Visor documento */}
            <div className="bg-slate-50 p-3 sm:p-5 lg:p-6">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                <span>Vista previa · maqueta</span>
                <span>pág. 3 / —</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Portada */}
                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <AccentLine accent={accent} className="mb-3 w-12" />
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: accent.primary }}
                  >
                    Tu Plan de Ataque
                  </p>
                  <h2
                    className="mt-2 text-base font-bold leading-snug"
                    style={{ color: accent.ink }}
                  >
                    Cómo conseguir más clientes desde ChatGPT en 90 días
                  </h2>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    Para {ctx.brandName}
                    {ctx.country ? ` · ${ctx.country}` : ''}
                    <br />
                    Generado {today}
                  </p>
                  <div className="mt-4 space-y-1.5">
                    {['Acciones priorizadas', 'Roadmap 90 días', 'Checklist'].map((t) => (
                      <div key={t} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: accent.primary }}
                        />
                        {t}
                      </div>
                    ))}
                  </div>
                </article>

                {/* Índice blur */}
                <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <AccentLine accent={accent} className="mb-3 w-12" />
                  <h2 className="text-sm font-bold" style={{ color: accent.ink }}>
                    Índice
                  </h2>
                  <ul className="mt-3 space-y-2 blur-[3px] select-none" aria-hidden>
                    {['Resumen', 'Competidores', 'Quick Wins', 'Roadmap', 'FAQ'].map((t) => (
                      <li key={t} className="text-xs text-slate-600">
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                    <Lock className="h-8 w-8 text-slate-400" />
                  </div>
                </article>

                {/* Prioridad #1 */}
                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:col-span-1">
                  <div
                    className="mb-3 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: accent.primary }}
                  >
                    Prioridad #1
                  </div>
                  <h2 className="text-sm font-bold leading-snug" style={{ color: accent.ink }}>
                    Publicar las siguientes FAQ
                  </h2>
                  <AccentLine accent={accent} className="mt-2 mb-3 w-16" />
                  <ol className="space-y-2">
                    {faqs.map((q, i) => (
                      <li key={q} className="flex gap-2 text-[11px] leading-snug text-slate-700">
                        <span
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: accent.primary }}
                        >
                          {i + 1}
                        </span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="relative mt-4 overflow-hidden rounded-md bg-slate-50 p-3">
                    <p className="blur-[2px] select-none text-[11px] text-slate-500">
                      Detalle de implementación, ejemplos de schema y checklist…
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>

          {/* CTA inferior — no funcional */}
          <div className="border-t border-slate-200 bg-slate-900 px-4 py-5 text-center sm:px-6">
            <p className="text-base font-semibold text-white sm:text-lg">
              Desbloqueá el plan completo
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Botón y checkout: todavía no cableados en este borrador.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 cursor-not-allowed rounded-xl px-5 py-2.5 text-sm font-semibold text-white opacity-80"
              style={{ backgroundColor: accent.primary }}
            >
              Desbloquear (próximamente)
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/borrador/plan-conquistar" className="underline hover:text-slate-700">
            ← Borrador landing Plan Conquistar
          </Link>
          {ctx.domain ? (
            <>
              {' · '}
              <span className="font-medium text-slate-600">{ctx.domain}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function PlanAtaqueDraftInner() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [loading, setLoading] = useState(Boolean(diagnosticId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<PlanConquistarLandingContext | null>(null);
  const [accent, setAccent] = useState<BrandAccent>(CLEEXS_FALLBACK);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!diagnosticId) {
      setLoading(false);
      setCtx(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    publicDiagnosticApi
      .get(diagnosticId)
      .then(async (diag) => {
        if (cancelled) return;
        const next = buildPlanConquistarLandingContext(diag);
        setCtx(next);

        let resolvedLogo: string | null = null;
        try {
          const asset = await brandAssetsApi.resolve({
            domain: next.domain,
            brandName: next.brandName,
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
          const fromLogo = await extractAccentFromLogoUrl(resolvedLogo, next.domain);
          if (!cancelled) setAccent(fromLogo);
        } else {
          setAccent(accentFromDomain(next.domain));
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('No pudimos cargar ese diagnóstico. Revisá el diagnosticId.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [diagnosticId]);

  if (!diagnosticId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-medium text-amber-800">Borrador · Plan de Ataque</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Falta diagnosticId</h1>
        <p className="mt-2 text-slate-600">
          Agregá <code className="rounded bg-slate-100 px-1 text-sm">?diagnosticId=…</code> a la
          URL.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando borrador…
      </div>
    );
  }

  if (loadError || !ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{loadError || 'Sin datos'}</p>
      </div>
    );
  }

  return <PlanAtaqueShell ctx={ctx} accent={accent} logoUrl={logoUrl} />;
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
