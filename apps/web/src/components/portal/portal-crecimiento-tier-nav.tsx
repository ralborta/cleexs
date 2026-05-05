'use client';

import Link from 'next/link';
import { ExternalLink, Headphones, Lock } from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

export type PortalCrecimientoTierNavProps = {
  basePath: string;
  runId: string;
  analysesUsed: number;
  analysesLimit: number | null;
  renewalLabel: string;
};

/**
 * Menú lateral para la misma “vista cliente” que el portal Free, pero con estética Crecimiento
 * y anclas pensadas para vivir a la DERECHA del contenido (columna layout).
 */
export function PortalCrecimientoTierNav({
  basePath,
  runId,
  analysesUsed,
  analysesLimit,
  renewalLabel,
}: PortalCrecimientoTierNavProps) {
  const analysesLabel =
    analysesLimit == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimit}`;
  const base = basePath.replace(/\/$/, '');

  return (
    <aside className="flex flex-col rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-white to-indigo-50/40 p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CleexsMark className="h-7 w-7" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Cleexs</p>
          <p className="font-bold leading-tight text-slate-900">Crecimiento</p>
        </div>
      </div>
      <nav className="space-y-1 text-sm">
        <a
          href={`${base}#portal-cliente`}
          className="flex items-center justify-between gap-2 rounded-lg bg-indigo-100 px-3 py-2 font-semibold text-indigo-950"
        >
          Resumen cuenta
          <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">CRECIÁ</span>
        </a>
        <a
          href={`${base}#comparacion`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-white/80"
        >
          Comparación
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
            Disponible
          </span>
        </a>
        <a
          href={`${base}#competidores`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-white/80"
        >
          Competidores
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
            Disponible
          </span>
        </a>
        <a
          href={`${base}#equipo`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-white/80"
        >
          Equipo
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
            Disponible
          </span>
        </a>

        <div className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Panel ampliado</div>
        {[
          { label: 'Prompts', href: `/portal-crecimiento/reporte/${runId}/premium/prompts` },
          { label: 'Historial', href: `/portal-crecimiento/reporte/${runId}/premium/historial` },
          { label: 'Reportes', href: `/portal-crecimiento/reporte/${runId}/premium/reportes` },
          { label: 'Herramientas', href: `/portal-crecimiento/reporte/${runId}/premium/herramientas` },
        ].map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-white/90"
          >
            <span className="flex items-center gap-1.5">
              <ExternalLink className="h-3 w-3 shrink-0 text-indigo-500" aria-hidden />
              {label}
            </span>
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900">
              Ir
            </span>
          </Link>
        ))}
        <Link
          href={`/portal-crecimiento/reporte/${runId}/premium/suscripcion`}
          className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-white/90"
        >
          <span>Suscripción</span>
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900">Ir</span>
        </Link>

        <div
          className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-slate-400"
          title="Ya estás en la vista principal tipo portal cliente"
        >
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Duplicar vista Free
        </div>
      </nav>

      <div className="mt-6 rounded-xl border border-indigo-100 bg-white/90 p-3 shadow-sm">
        <p className="text-xs font-medium text-slate-500">Esta columna</p>
        <p className="mt-1 text-sm font-bold text-indigo-950">Menú Crecimiento</p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
          El centro es la misma vista que el portal Free; acá accedés al hub ampliado y al anexo técnico.
        </p>
        <p className="mt-2 text-[11px] text-slate-600">Uso mensual (scores vistos)</p>
        <p className="text-sm font-semibold text-slate-900">{analysesLabel}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{
              width: `${analysesLimit ? Math.min(100, (analysesUsed / Math.max(1, analysesLimit)) * 100) : 50}%`,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Corte {renewalLabel}</p>
        <Link
          href={`/portal-crecimiento/reporte/${runId}`}
          className="mt-3 block w-full rounded-lg border border-indigo-200 bg-white py-2 text-center text-xs font-semibold text-indigo-900 hover:bg-indigo-50"
        >
          Anexo técnico (corrida)
        </Link>
        <Link
          href={`/portal-crecimiento/reporte/${runId}/premium`}
          className="mt-2 block w-full rounded-lg bg-indigo-600 py-2 text-center text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Panel Premium
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end pt-6">
        <div className="flex items-center gap-2 rounded-lg border border-indigo-100/80 bg-white/70 px-3 py-2 text-xs text-slate-600">
          <Headphones className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
          <span>Soporte Crecimiento</span>
        </div>
      </div>
    </aside>
  );
}
