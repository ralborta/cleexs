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

/** Demo con color fuerte en el logo (Nintendo). Override: ?diagnosticId=… */
const DEMO_DIAGNOSTIC_ID = '47e21617-917d-4e00-b7ee-62585b0d5461';

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
          const asset = await brandAssetsApi.resolve({
            domain,
            brandName: built.ctx.brandName,
          });
          if (asset.status === 'ok' && asset.logoUrl && !asset.logoUrl.includes('brandfetch.io')) {
            nextAccent = await extractAccentFromLogoUrl(asset.logoUrl, domain);
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
    const { ctx } = doc;
    const enginesText =
      ctx.engines.length === 0
        ? 'ChatGPT'
        : ctx.engines.length <= 2
          ? ctx.engines.join(' y ')
          : `${ctx.engines.slice(0, -1).join(', ')} y ${ctx.engines[ctx.engines.length - 1]}`;
    const planUrl = `/plan-conquistar?diagnosticId=${encodeURIComponent(diagnosticId)}`;
    const reportUrl = `/ver-resultado?id=${encodeURIComponent(diagnosticId)}`;
    const topCompetitor = ctx.competitors[0]?.name || 'un rival del rubro';
    return { ctx, enginesText, planUrl, reportUrl, topCompetitor };
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
      </div>
    );
  }

  const { ctx, enginesText, planUrl, reportUrl, topCompetitor } = preview;
  const score = ctx.cleexsScore != null ? Math.round(ctx.cleexsScore) : null;
  const rivals =
    ctx.competitors.slice(0, 3).map((c) => c.name).join(', ') || 'ver en tu reporte';
  const scorePct = score != null ? Math.min(100, Math.max(0, score)) : 0;

  return (
    <div className="min-h-screen bg-slate-200/80 px-3 py-8 sm:px-6">
      <div className="mx-auto mb-5 max-w-[680px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Borrador para Gon · email día 0</p>
        <p className="mt-1 text-amber-900/80">
          <strong>Cuerpo</strong> = mail actual (carta + score).{' '}
          <strong>Pie</strong> = carátula del Plan de Ataque + tarjetitas (reemplaza la caja vieja
          del Plan Conquistar).
        </p>
        <p className="mt-2 text-xs text-amber-800/70">
          Demo: <span className="font-medium">{ctx.brandName}</span> · {ctx.domain} ·{' '}
          <Link href="/borrador/email-dia0-opcion-b" className="underline">
            ver Opción B (tarjeta arriba)
          </Link>
        </p>
      </div>

      <div className="mx-auto max-w-[680px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-6">
          <p>
            <span className="font-semibold text-slate-700">De:</span> Cleexs &lt;hola@cleexs.net&gt;
          </p>
          <p className="mt-0.5">
            <span className="font-semibold text-slate-700">Asunto:</span> Le preguntamos 100 veces a
            ChatGPT
          </p>
        </div>

        <div className="bg-[#f8fafc] px-4 py-7 sm:px-8">
          {/* ========== CUERPO (igual que hoy) ========== */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Cuerpo del mail · sin cambios
          </p>

          <img
            src="/CleexsLogo.png"
            alt="Cleexs"
            width={110}
            className="mb-5 h-auto w-[110px]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          <div className="space-y-5 text-[19px] leading-[1.85] text-slate-800">
            <p>
              Esta semana repetimos la misma pregunta decenas de veces. Esperábamos respuestas muy
              distintas. Pero los mismos nombres aparecían una y otra vez.
            </p>
            <p>
              Parece haber una especie de grupo favorito. Todavía estamos investigando por qué. Pero
              si esto es así, entrar en ese grupo puede ser extremadamente valioso.
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <img
              src="/gonzalo-founder.png"
              alt="Gonzalo"
              className="h-11 w-11 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="text-sm leading-tight">
              <p className="font-semibold text-slate-800">Gonzalo</p>
              <p className="text-slate-500">Fundador</p>
            </div>
          </div>

          {/* Score insight (cuerpo actual) */}
          <div className="mt-6 overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
            <div className="grid sm:grid-cols-[34%_66%]">
              <div className="border-b border-slate-100 p-4 text-center sm:border-b-0 sm:border-r">
                <span className="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">
                  Benchmark del rubro
                </span>
                <p className="mt-3 text-xs text-slate-500">Cleexs Score</p>
                <div
                  className="mx-auto mt-2 flex h-[118px] w-[118px] items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#2563eb 0 ${scorePct}%, #dbeafe ${scorePct}% 100%)`,
                  }}
                >
                  <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white shadow-sm">
                    <span className="text-4xl font-black tracking-tight text-blue-600">
                      {score ?? '—'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">de 100</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 p-4 text-[13px] leading-snug text-slate-600">
                <p>
                  <span className="font-semibold text-slate-700">Rivales detectados:</span> {rivals}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Señal:</span> Hoy {topCompetitor}{' '}
                  aparece más que {ctx.brandName} en consultas del rubro.
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Acción sugerida:</span> Reforzar
                  señales en {ctx.domain} para subir recomendaciones.
                </p>
                <div className="pt-2 text-right">
                  <Link
                    href={reportUrl}
                    className="inline-block rounded-[10px] bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    Ver reporte →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-slate-500">
            <Link href={reportUrl} className="underline-offset-2 hover:underline">
              Compartir reporte
            </Link>
            <span className="mx-2">·</span>
            <Link href="/diagnostico" className="underline-offset-2 hover:underline">
              Generar nuevo diagnóstico
            </Link>
          </p>
          <p className="mt-1 text-center text-xs text-slate-400">
            Gratis · tarda unos minutos · solo si vos lo pedís
          </p>

          <p className="mt-6 text-[17px] italic leading-relaxed text-slate-500">
            PD: ¿Alguna vez le preguntaste a ChatGPT por empresas de tu industria?
          </p>

          {/* ========== PIE (nuevo: carátula + tarjetitas) ========== */}
          <div className="mt-10 border-t-2 border-dashed border-amber-300 pt-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Pie del mail · acá va el Plan (reemplaza la caja actual de Plan Conquistar)
            </p>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
              <div
                className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: accent.primary }}
              >
                <span className="rounded-full bg-white/20 px-2 py-0.5">Plan Conquistar</span>
                <span className="opacity-95">Plan de Ataque: dominá {enginesText} en 90 días</span>
              </div>

              <div className="relative p-4 sm:p-5">
                <IndustryCoverWatermark
                  industry={ctx.industry}
                  domain={ctx.domain}
                  brandName={ctx.brandName}
                  accent={accent}
                />
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 w-fit rounded-xl bg-white/90 p-1 shadow-sm backdrop-blur-[2px]">
                      <BrandLogo
                        name={ctx.brandName}
                        domain={ctx.domain}
                        size={56}
                        variant="logo"
                        hideIfMissing
                        className="rounded-xl"
                      />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Tu Plan de Ataque</h2>
                    <div
                      className="mt-1.5 h-1.5 w-12 rounded-full"
                      style={{ backgroundColor: accent.primary }}
                    />
                    <p className="mt-2 text-sm text-slate-600">
                      Preparado exclusivamente para{' '}
                      <span className="font-bold" style={{ color: accent.primary }}>
                        {ctx.domain}
                      </span>
                    </p>
                    <p className="mt-2 text-sm italic text-slate-500">
                      Plan de acción concreto para empezar mañana con tu equipo.
                    </p>
                  </div>
                </div>

                {/* Tarjetitas */}
                <div className="relative z-10 mt-4 grid grid-cols-3 gap-1.5 sm:gap-2.5">
                  {[
                    {
                      Icon: Target,
                      primary:
                        ctx.opportunityCount != null ? String(ctx.opportunityCount) : '—',
                      secondary: 'acciones',
                      emphasize: false,
                    },
                    {
                      Icon: TrendingUp,
                      primary: 'ALTO',
                      secondary: 'impacto',
                      emphasize: true,
                    },
                    {
                      Icon: Calendar,
                      primary: '90',
                      secondary: 'días',
                      emphasize: false,
                    },
                  ].map(({ Icon, primary, secondary, emphasize }) => (
                    <div
                      key={secondary}
                      className="flex flex-col items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-1.5 py-2.5 text-center shadow-sm sm:flex-row sm:gap-2 sm:px-3 sm:py-3 sm:text-left"
                    >
                      <Icon
                        className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                        strokeWidth={1.75}
                        style={{ color: accent.primary }}
                      />
                      <div className="min-w-0 leading-tight">
                        <p
                          className="truncate text-sm font-bold sm:text-base"
                          style={emphasize ? { color: accent.primary } : undefined}
                        >
                          {primary}
                        </p>
                        <p className="truncate text-[10px] text-slate-600 sm:text-xs">
                          {secondary}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative z-10 mt-4 text-right">
                  <Link
                    href={planUrl}
                    className="inline-block rounded-[10px] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: accent.primary }}
                  >
                    Ver cómo es →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Footer legal */}
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
