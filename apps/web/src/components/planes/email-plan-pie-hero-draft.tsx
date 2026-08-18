'use client';

/**
 * Versión oficial del mail día 0 (post-diagnóstico):
 * cuerpo + pie Plan listo. Sin ejemplos secundarios.
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PlanAtaqueEmailHero } from '@/components/planes/plan-ataque-email-hero';
import { brandAssetsApi, publicDiagnosticApi } from '@/lib/api';
import {
  CLEEXS_FALLBACK,
  accentFromDomain,
  extractAccentFromLogoUrl,
  type BrandAccent,
} from '@/lib/brand-accent-from-logo';
import { buildPlanAtaqueDocument } from '@/lib/plan-ataque-document';

const DEMO_ID = '47e21617-917d-4e00-b7ee-62585b0d5461'; // Nintendo
const ALT_ID = '13a274a5-408c-47d4-9532-d45555e266b1'; // Coppel

type Preview = {
  id: string;
  brandName: string;
  domain: string;
  accent: BrandAccent;
  actionsCount: number | null;
  score: number | null;
  planUrl: string;
  reportUrl: string;
  industry: string | null;
  rivals: string;
  topCompetitor: string;
};

function OfficialInner() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId')?.trim() || DEMO_ID;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const diagnostic = await publicDiagnosticApi.get(diagnosticId);
        const doc = buildPlanAtaqueDocument(diagnostic);
        const domain = doc.ctx.domain || diagnostic.domain || 'cleexs.net';
        let accent = accentFromDomain(domain);
        try {
          const asset = await brandAssetsApi.resolve({
            domain,
            brandName: doc.ctx.brandName,
          });
          if (asset.status === 'ok' && asset.logoUrl && !asset.logoUrl.includes('brandfetch.io')) {
            accent = await extractAccentFromLogoUrl(asset.logoUrl, domain);
          }
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        const rivals = doc.ctx.competitors.slice(0, 3).map((c) => c.name).join(', ') || 'ver en tu reporte';
        setPreview({
          id: diagnosticId,
          brandName: doc.ctx.brandName,
          domain,
          accent,
          actionsCount: doc.ctx.opportunityCount,
          score: doc.ctx.cleexsScore != null ? Math.round(doc.ctx.cleexsScore) : null,
          planUrl: `/plan-conquistar?diagnosticId=${encodeURIComponent(diagnosticId)}`,
          reportUrl: `/ver-resultado?id=${encodeURIComponent(diagnosticId)}`,
          industry: doc.ctx.industry ?? null,
          rivals,
          topCompetitor: doc.ctx.competitors[0]?.name || 'un rival del rubro',
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagnosticId]);

  const scorePct = useMemo(() => {
    if (preview?.score == null) return 0;
    return Math.min(100, Math.max(0, preview.score));
  }, [preview?.score]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        Armando versión oficial…
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || 'Sin datos.'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200/80 px-3 py-8 sm:px-6">
      <div className="mx-auto mb-4 max-w-[680px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <p className="font-semibold">Versión oficial · mail día 0 post-diagnóstico</p>
        <p className="mt-1 text-emerald-900/80">
          Correo completo (cuerpo + pie). Sin ejemplos secundarios. Listo para producción.
        </p>
        <p className="mt-2 text-xs text-emerald-800/70">
          Demo:{' '}
          <Link href={`/borrador/email-plan-pie-hero?diagnosticId=${DEMO_ID}`} className="underline">
            Nintendo
          </Link>
          {' · '}
          <Link href={`/borrador/email-plan-pie-hero?diagnosticId=${ALT_ID}`} className="underline">
            Coppel
          </Link>
        </p>
      </div>

      <div className="mx-auto max-w-[680px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-6">
          <p>
            <span className="font-semibold text-slate-700">De:</span> Cleexs &lt;hola@cleexs.net&gt;
          </p>
          <p className="mt-0.5">
            <span className="font-semibold text-slate-700">Asunto:</span> Tu diagnóstico Cleexs para{' '}
            {preview.brandName}
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

          <div className="space-y-5 text-[19px] leading-[1.85] text-slate-800">
            <p>Hola,</p>
            <p>Gracias por completar tu diagnóstico free en Cleexs.</p>
            <p>
              En <strong>{preview.domain}</strong> vimos señales concretas sobre cómo te encuentran
              hoy los motores de IA. Tu Cleexs Score es{' '}
              <strong style={{ color: preview.accent.primary }}>{preview.score ?? '—'}</strong>.
            </p>
            <p>En los próximos días te vamos a mandar tips cortos para mejorar esa visibilidad.</p>
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

          {/* Score / rivales (cuerpo actual del letter) */}
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
                      {preview.score ?? '—'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">de 100</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 p-4 text-[13px] leading-snug text-slate-600">
                <p>
                  <span className="font-semibold text-slate-700">Rivales detectados:</span>{' '}
                  {preview.rivals}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Señal:</span> Hoy{' '}
                  {preview.topCompetitor} aparece más que {preview.brandName} en consultas del
                  rubro.
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Acción sugerida:</span> Reforzar
                  señales en {preview.domain} para subir recomendaciones.
                </p>
                <div className="pt-2 text-right">
                  <Link
                    href={preview.reportUrl}
                    className="inline-block rounded-[10px] bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    Ver reporte →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-slate-500">
            <Link href={preview.reportUrl} className="underline-offset-2 hover:underline">
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

          {/* PIE oficial */}
          <div className="mt-8">
            <PlanAtaqueEmailHero
              brandName={preview.brandName}
              domain={preview.domain}
              accent={preview.accent}
              actionsCount={preview.actionsCount}
              planUrl={preview.planUrl}
              industry={preview.industry}
            />
          </div>

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

export function EmailPlanPieHeroDraft() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
          Cargando…
        </div>
      }
    >
      <OfficialInner />
    </Suspense>
  );
}
