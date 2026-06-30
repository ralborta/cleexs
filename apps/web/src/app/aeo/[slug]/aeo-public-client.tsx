'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { AeoReport, type AeoContentResult } from '@/components/aeo-audit/aeo-report';
import { CLEEXS_MARKETING_URL } from '@/lib/site';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type PublicAeo = {
  slug: string;
  siteLabel: string | null;
  targetUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scoreBefore: number | null;
  scoreAfter: number | null;
  result: AeoContentResult | null;
  generatedAt: string;
};

export function AeoPublicClient({ slug }: { slug: string }) {
  const [audit, setAudit] = useState<PublicAeo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/aeo-audit/${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      setAudit((await res.json()) as PublicAeo);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!audit || (audit.status !== 'running' && audit.status !== 'pending')) return;
    const t = setTimeout(() => void load(), 4000);
    return () => clearTimeout(t);
  }, [audit, load]);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 md:px-6">
          <Link href={CLEEXS_MARKETING_URL} className="flex items-center gap-2">
            <CleexsMark className="h-7 w-auto" />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
            <Sparkles className="h-3.5 w-3.5" /> Análisis AEO
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-violet-500" />
            <p className="mt-3 text-sm text-slate-500">Cargando tu informe…</p>
          </div>
        ) : notFound ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
            <h1 className="mt-4 text-lg font-bold text-slate-900">Informe no encontrado</h1>
            <p className="mt-1 text-sm text-slate-500">
              El link puede ser incorrecto o el informe fue eliminado. Escribinos si creés que es un error.
            </p>
          </div>
        ) : audit ? (
          <>
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
                Análisis y reescritura para
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
                {audit.siteLabel || audit.targetUrl}
              </h1>
              <a
                href={audit.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-violet-700"
              >
                {audit.targetUrl}
              </a>
            </div>

            {audit.status === 'running' || audit.status === 'pending' ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-10 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-sky-500" />
                <p className="mt-3 text-sm font-semibold text-sky-800">Estamos generando tu análisis…</p>
                <p className="mt-1 text-xs text-sky-600">Esta página se actualiza sola en unos segundos.</p>
              </div>
            ) : audit.status === 'failed' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                <p className="font-semibold text-amber-900">Estamos terminando de procesar tu informe</p>
                <p className="mt-1 text-sm text-amber-700">
                  Volvé a intentar en unos minutos o escribinos y lo resolvemos.
                </p>
              </div>
            ) : audit.result ? (
              <AeoReport result={audit.result} />
            ) : null}

            {audit.status === 'completed' && (
              <div className="mt-8 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6 text-center shadow-sm">
                <h2 className="text-base font-bold text-slate-900">
                  ¿Querés que implementemos estos cambios por vos?
                </h2>
                <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
                  En Cleexs medimos y optimizamos cómo te ven las IAs. Te ayudamos a aplicar esta
                  reescritura y a medir el impacto en ChatGPT, Gemini, Perplexity y Claude.
                </p>
                <a
                  href={CLEEXS_MARKETING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
                >
                  Conocer Cleexs
                </a>
              </div>
            )}

            <p className="mt-8 text-center text-xs text-slate-400">
              Informe generado por Cleexs · {new Date(audit.generatedAt).toLocaleDateString('es-AR')}
            </p>
          </>
        ) : (
          <div className="py-20 text-center text-sm text-slate-500">No se pudo cargar el informe.</div>
        )}
      </div>
    </main>
  );
}
