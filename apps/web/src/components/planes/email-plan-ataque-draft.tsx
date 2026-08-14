'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Calendar, Loader2, Target, TrendingUp } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { IndustryCoverWatermark } from '@/components/planes/industry-cover-watermark';
import { brandAssetsApi, publicDiagnosticApi } from '@/lib/api';
import {
  CLEEXS_FALLBACK,
  accentFromDomain,
  extractAccentFromLogoUrl,
  type BrandAccent,
} from '@/lib/brand-accent-from-logo';
import { buildPlanAtaqueDocument } from '@/lib/plan-ataque-document';

/** Ejemplo real (Grimoldi) para mostrar a Gon sin pegar ID. */
const DEMO_DIAGNOSTIC_ID = 'edf9d12b-9093-4a5e-b683-414de5b0f6f2';

function EmailPlanAtaqueInner() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId')?.trim() || DEMO_DIAGNOSTIC_ID;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accent, setAccent] = useState<BrandAccent>(CLEEXS_FALLBACK);
  const [doc, setDoc] = useState<ReturnType<typeof buildPlanAtaqueDocument> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const diagnostic = await publicDiagnosticApi.get(diagnosticId);
        if (cancelled) return;
        const built = buildPlanAtaqueDocument(diagnostic);
        setDoc(built);

        const domain = built.ctx.domain || diagnostic.domain || 'cleexs.net';
        let nextAccent = accentFromDomain(domain);
        try {
          const assets = await brandAssetsApi.byDomain(domain);
          const logoUrl = assets.logoUrl || assets.iconUrl;
          if (logoUrl) {
            const fromLogo = await extractAccentFromLogoUrl(logoUrl);
            if (fromLogo) nextAccent = fromLogo;
          }
        } catch {
          /* fallback por dominio */
        }
        if (!cancelled) setAccent(nextAccent);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el diagnóstico.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagnosticId]);

  const preview = useMemo(() => {
    if (!doc) return null;
    const { ctx, immediatePlan } = doc;
    const enginesText =
      ctx.engines.length === 0
        ? 'ChatGPT'
        : ctx.engines.length <= 2
          ? ctx.engines.join(' y ')
          : `${ctx.engines.slice(0, -1).join(', ')} y ${ctx.engines[ctx.engines.length - 1]}`;
    const priorityTheme = immediatePlan[0]?.theme || 'Primeras acciones del plan';
    const priorityTasks = (immediatePlan[0]?.tasks ?? ctx.topActions).slice(0, 3);
    const today = new Date().toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const planUrl = `/plan-conquistar?diagnosticId=${encodeURIComponent(diagnosticId)}`;
    const reportUrl = `/ver-resultado?id=${encodeURIComponent(diagnosticId)}`;
    return { ctx, enginesText, priorityTheme, priorityTasks, today, planUrl, reportUrl };
  }, [doc, diagnosticId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        Armando borrador del mail…
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || 'Sin datos para el borrador.'}
        <p className="mt-2 text-xs text-rose-600">
          Probá con{' '}
          <code className="rounded bg-white/80 px-1">?diagnosticId=…</code>
        </p>
      </div>
    );
  }

  const { ctx, enginesText, priorityTheme, priorityTasks, today, planUrl, reportUrl } = preview;
  const score = ctx.cleexsScore != null ? Math.round(ctx.cleexsScore) : null;
  const rivals = ctx.competitors.slice(0, 3).map((c) => c.name).join(', ') || 'rivales del rubro';

  return (
    <div className="min-h-screen bg-slate-200/80 px-3 py-8 sm:px-6">
      <div className="mx-auto mb-5 max-w-[680px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Borrador para Gon · email día 0 (post-diagnóstico)</p>
        <p className="mt-1 text-amber-900/80">
          Misma carátula del Plan de Ataque + preview de Prioridad #1. No se envía; es solo maqueta.
        </p>
        <p className="mt-2 text-xs text-amber-800/70">
          Demo: <span className="font-medium">{ctx.brandName}</span> · {ctx.domain} ·{' '}
          <Link href={planUrl} className="underline">
            ver landing
          </Link>
        </p>
      </div>

      {/* Marco tipo cliente de correo */}
      <div className="mx-auto max-w-[680px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-6">
          <p>
            <span className="font-semibold text-slate-700">De:</span> Cleexs &lt;hola@cleexs.net&gt;
          </p>
          <p className="mt-0.5">
            <span className="font-semibold text-slate-700">Asunto:</span> Tu Cleexs Score y el Plan
            de Ataque para {ctx.brandName}
          </p>
        </div>

        <div className="bg-[#f8fafc] px-4 py-7 sm:px-8">
          <img
            src="/CleexsLogo.png"
            alt="Cleexs"
            width={110}
            className="mb-5 h-auto w-[110px]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          <div className="space-y-4 text-[17px] leading-relaxed text-slate-800">
            <p>Hola{ctx.brandName ? ` — equipo ${ctx.brandName}` : ''},</p>
            <p>
              Terminamos de preguntarle a ChatGPT por marcas de tu rubro. Acá va tu primer resumen
              y el Plan de Ataque armado con tu diagnóstico.
            </p>
          </div>

          {/* Score box */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Exclusivo para {ctx.domain}
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-slate-900 text-white">
                <span className="text-2xl font-bold tabular-nums">{score ?? '—'}</span>
                <span className="text-[9px] uppercase tracking-wide text-slate-300">Score</span>
              </div>
              <div className="text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Rivales detectados:</span> {rivals}
                </p>
                <p className="mt-2">
                  <span className="font-semibold text-slate-800">Señal:</span> hoy aparecen más que{' '}
                  {ctx.brandName} en consultas del rubro.
                </p>
                <p className="mt-2">
                  <span className="font-semibold text-slate-800">Acción sugerida:</span> empezar por
                  la Prioridad #1 del plan (abajo).
                </p>
              </div>
            </div>
          </div>

          {/* Carátula Plan de Ataque */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
            <div
              className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: accent.primary }}
            >
              <span className="rounded-full bg-white/20 px-2 py-0.5">Plan Conquistar</span>
              <span className="opacity-90">Tu Plan de Ataque · 90 días</span>
            </div>

            <div className="relative p-4 sm:p-5">
              <IndustryCoverWatermark
                industry={ctx.industry}
                domain={ctx.domain}
                brandName={ctx.brandName}
                accent={accent}
              />
              <div className="relative z-10">
                <div className="mb-3 w-fit rounded-xl bg-white/90 p-1 shadow-sm backdrop-blur-[2px]">
                  <BrandLogo
                    name={ctx.brandName}
                    domain={ctx.domain}
                    size={72}
                    variant="logo"
                    hideIfMissing
                    className="rounded-xl"
                  />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Tu Plan de Ataque</h2>
                <div
                  className="mt-2 h-1.5 w-14 rounded-full"
                  style={{ backgroundColor: accent.primary }}
                />
                <p className="mt-3 text-sm leading-snug text-slate-700">
                  Cómo conseguir más clientes desde {enginesText}{' '}
                  <span className="font-semibold" style={{ color: accent.primary }}>
                    en los próximos 90 días
                  </span>
                </p>
                <p className="mt-4 text-[11px] text-slate-500">Preparado exclusivamente para</p>
                <p className="text-base font-bold" style={{ color: accent.primary }}>
                  {ctx.domain}
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    { Icon: Calendar, t: `Generado el: ${today}` },
                    {
                      Icon: Target,
                      t:
                        ctx.opportunityCount != null
                          ? `${ctx.opportunityCount} acciones priorizadas`
                          : 'Acciones priorizadas',
                    },
                    { Icon: TrendingUp, t: 'Impacto esperado: ALTO' },
                  ].map(({ Icon, t }) => (
                    <div key={t} className="flex items-center gap-2 text-xs text-slate-600">
                      <Icon className="h-3.5 w-3.5" style={{ color: accent.primary }} />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Prioridad #1 teaser */}
            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
              <p
                className="text-[11px] font-bold uppercase tracking-wide"
                style={{ color: accent.primary }}
              >
                Prioridad #1
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">{priorityTheme}</p>
              <ol className="mt-3 space-y-2">
                {priorityTasks.map((task, i) => (
                  <li key={`${i}-${task.slice(0, 20)}`} className="flex gap-2 text-xs text-slate-700">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: accent.primary }}
                    >
                      {i + 1}
                    </span>
                    <span className="leading-snug">{task}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs italic text-slate-500">
                Plan de acción concreto para empezar mañana con tu equipo.
              </p>
              <div className="mt-4 text-right">
                <Link
                  href={planUrl}
                  className="inline-block rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm"
                  style={{ backgroundColor: accent.primary }}
                >
                  Ver mi Plan de Ataque
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm">
            <Link href={reportUrl} className="font-medium text-violet-700 underline-offset-2 hover:underline">
              Ver reporte completo
            </Link>
          </p>

          <p className="mt-6 text-[15px] italic leading-relaxed text-slate-500">
            PD: ¿Alguna vez le preguntaste a ChatGPT por empresas de tu industria?
          </p>

          <div className="mt-8 border-t border-slate-200 pt-5 text-center text-xs leading-relaxed text-slate-400">
            <p>
              <span className="underline">Dejar de recibir emails</span>
            </p>
            <p className="mt-1">Cleexs - Conseguí clientes desde ChatGPT</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmailPlanAtaqueDraft() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
          Cargando…
        </div>
      }
    >
      <EmailPlanAtaqueInner />
    </Suspense>
  );
}
