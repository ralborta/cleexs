'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
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

/** Dos clientes reales para mostrar a Gon. */
const CLIENTS = [
  { id: '47e21617-917d-4e00-b7ee-62585b0d5461', label: 'Nintendo' },
  { id: '13a274a5-408c-47d4-9532-d45555e266b1', label: 'Coppel' },
] as const;

type ClientPreview = {
  id: string;
  brandName: string;
  domain: string;
  accent: BrandAccent;
  actionsCount: number | null;
  score: number | null;
  planUrl: string;
  generatedAt: Date;
};

function EmailPlanPieHeroInner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientPreview[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded: ClientPreview[] = [];
        for (const c of CLIENTS) {
          const diagnostic = await publicDiagnosticApi.get(c.id);
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
            /* fallback */
          }
          loaded.push({
            id: c.id,
            brandName: doc.ctx.brandName,
            domain,
            accent,
            actionsCount: doc.ctx.opportunityCount,
            score: doc.ctx.cleexsScore != null ? Math.round(doc.ctx.cleexsScore) : null,
            planUrl: `/plan-conquistar?diagnosticId=${encodeURIComponent(c.id)}`,
            generatedAt: new Date(),
          });
        }
        if (!cancelled) setClients(loaded);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        Cargando 2 clientes reales…
      </div>
    );
  }

  if (error || clients.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || 'Sin datos.'}
      </div>
    );
  }

  const current = clients[active]!;

  return (
    <div className="min-h-screen bg-slate-200/80 px-3 py-8 sm:px-6">
      <div className="mx-auto mb-5 max-w-[720px] rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
        <p className="font-semibold">Borrador · pie del mail con diseño “Plan listo”</p>
        <p className="mt-1 text-violet-900/80">
          Misma pieza del mock, con datos reales. En producción sería imagen generada + botón
          linkeable. Acá es maqueta HTML para mostrarle a Gon.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {clients.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(i)}
              className={
                i === active
                  ? 'rounded-full bg-violet-700 px-3 py-1.5 text-xs font-bold text-white'
                  : 'rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800'
              }
            >
              {c.brandName} · {c.domain}
              {c.score != null ? ` · score ${c.score}` : ''}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-violet-800/70">
          <Link href="/borrador/email-plan-ataque" className="underline">
            Opción A (mail completo)
          </Link>
          {' · '}
          <Link href="/borrador/email-dia0-opcion-b" className="underline">
            Opción B
          </Link>
        </p>
      </div>

      {/* Marco email corto */}
      <div className="mx-auto max-w-[720px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-6">
          <p>
            <span className="font-semibold text-slate-700">De:</span> Cleexs &lt;hola@cleexs.net&gt;
          </p>
          <p className="mt-0.5">
            <span className="font-semibold text-slate-700">Asunto:</span> Tu diagnóstico Cleexs para{' '}
            {current.brandName}
          </p>
        </div>

        <div className="bg-[#f8fafc] px-4 py-6 sm:px-7">
          <img
            src="/CleexsLogo.png"
            alt="Cleexs"
            width={100}
            className="mb-4 h-auto w-[100px]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          <div className="mb-5 space-y-3 text-[17px] leading-relaxed text-slate-800">
            <p>Hola,</p>
            <p>Gracias por completar tu diagnóstico free en Cleexs.</p>
            <p>
              En <strong>{current.domain}</strong> vimos señales concretas sobre cómo te encuentran
              hoy los motores de IA. Tu Cleexs Score es{' '}
              <strong style={{ color: current.accent.primary }}>
                {current.score ?? '—'}
              </strong>
              .
            </p>
            <p className="text-sm italic text-slate-500">
              … (cuerpo día 0) · abajo el pie con el Plan ↓
            </p>
          </div>

          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Pie del mail · pieza personalizada
          </p>

          <PlanAtaqueEmailHero
            brandName={current.brandName}
            domain={current.domain}
            accent={current.accent}
            actionsCount={current.actionsCount}
            planUrl={current.planUrl}
            generatedAt={current.generatedAt}
          />

          <div className="mt-8 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
            <p>
              <span className="underline">Dejar de recibir emails</span>
            </p>
            <p className="mt-1">Cleexs - Conseguí clientes desde ChatGPT</p>
          </div>
        </div>
      </div>

      {/* Vista lado a lado en desktop */}
      <div className="mx-auto mt-10 hidden max-w-[1100px] lg:block">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
          Los 2 clientes juntos
        </p>
        <div className="grid grid-cols-2 gap-4">
          {clients.map((c) => (
            <PlanAtaqueEmailHero
              key={c.id}
              brandName={c.brandName}
              domain={c.domain}
              accent={c.accent}
              actionsCount={c.actionsCount}
              planUrl={c.planUrl}
              generatedAt={c.generatedAt}
            />
          ))}
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
      <EmailPlanPieHeroInner />
    </Suspense>
  );
}
