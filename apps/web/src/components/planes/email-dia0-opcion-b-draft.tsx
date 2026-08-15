'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { publicDiagnosticApi } from '@/lib/api';
import { buildPlanAtaqueDocument } from '@/lib/plan-ataque-document';

/** Mismo demo que la opción A (Nintendo). */
const DEMO_DIAGNOSTIC_ID = '47e21617-917d-4e00-b7ee-62585b0d5461';

function EmailDia0OpcionBInner() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId')?.trim() || DEMO_DIAGNOSTIC_ID;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<ReturnType<typeof buildPlanAtaqueDocument> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const diagnostic = await publicDiagnosticApi.get(diagnosticId);
        if (cancelled) return;
        setDoc(buildPlanAtaqueDocument(diagnostic));
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
    const reportUrl = `/ver-resultado?id=${encodeURIComponent(diagnosticId)}`;
    const topCompetitor = ctx.competitors[0]?.name || 'un rival del rubro';
    const rivals =
      ctx.competitors.slice(0, 3).map((c) => c.name).join(', ') || 'ver en tu reporte';
    const score = ctx.cleexsScore != null ? Math.round(ctx.cleexsScore) : null;
    return { ctx, reportUrl, topCompetitor, rivals, score };
  }, [doc, diagnosticId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        Armando opción B…
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

  const { ctx, reportUrl, topCompetitor, rivals, score } = preview;
  const scorePct = score != null ? Math.min(100, Math.max(0, score)) : 0;

  return (
    <div className="min-h-screen bg-slate-200/80 px-3 py-8 sm:px-6">
      <div className="mx-auto mb-5 max-w-[680px] rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-semibold">Opción B · para comparar con Gon</p>
        <p className="mt-1 text-sky-900/80">
          Tarjeta de score + rivales <strong>arriba</strong> (como la teníamos). Sin pie del Plan de
          Ataque. El cuerpo de la carta va después.
        </p>
        <p className="mt-2 text-xs text-sky-800/70">
          Demo: {ctx.brandName} ·{' '}
          <Link href="/borrador/email-plan-ataque" className="underline">
            ver Opción A (pie con plan)
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
          <img
            src="/CleexsLogo.png"
            alt="Cleexs"
            width={110}
            className="mb-5 h-auto w-[110px]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          {/* TARJETA ARRIBA */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-700">
            Tarjeta score / rivales · arriba
          </p>
          <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
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

          {/* CUERPO CARTA */}
          <div className="mt-8 space-y-5 text-[19px] leading-[1.85] text-slate-800">
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

          <p className="mt-6 text-[17px] italic leading-relaxed text-slate-500">
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

export function EmailDia0OpcionBDraft() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
          Cargando…
        </div>
      }
    >
      <EmailDia0OpcionBInner />
    </Suspense>
  );
}
