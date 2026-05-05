'use client';

import Link from 'next/link';
import { ExternalLink, Headphones, Sparkles } from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

export type PortalCrecimientoTierNavProps = {
  basePath: string;
  runId: string;
  analysesUsed: number;
  analysesLimit: number | null;
  renewalLabel: string;
};

/** Menú derecho: mismos anclas que Free; enlaces al hub Premium y anexo técnico. Estética alineada al portal cliente. */
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
    <aside className="flex h-fit flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:sticky lg:top-5">
      <div className="mb-4 flex items-center gap-2.5">
        <CleexsMark className="h-8 w-8" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-700">Cleexs</p>
          <p className="text-base font-bold leading-tight text-slate-900">Crecimiento</p>
        </div>
      </div>
      <nav className="space-y-1 text-sm">
        <a
          href={`${base}#portal-cliente`}
          className="flex items-center justify-between gap-2 rounded-xl bg-violet-50 px-3 py-2.5 font-semibold text-violet-950 ring-1 ring-violet-100/80"
        >
          Resumen cuenta
          <span className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Hub
          </span>
        </a>
        <a
          href={`${base}#comparacion`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          Comparación
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            Disponible
          </span>
        </a>
        <a
          href={`${base}#competidores`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          Competidores
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            Disponible
          </span>
        </a>
        <a
          href={`${base}#equipo`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          Equipo
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            Disponible
          </span>
        </a>

        <p className="pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Panel ampliado</p>
        {[
          { label: 'Prompts', href: `/portal-crecimiento/reporte/${runId}/premium/prompts` },
          { label: 'Historial', href: `/portal-crecimiento/reporte/${runId}/premium/historial` },
          { label: 'Reportes', href: `/portal-crecimiento/reporte/${runId}/premium/reportes` },
          { label: 'Herramientas', href: `/portal-crecimiento/reporte/${runId}/premium/herramientas` },
        ].map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
              {label}
            </span>
            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">Ir</span>
          </Link>
        ))}
        <Link
          href={`/portal-crecimiento/reporte/${runId}/premium/suscripcion`}
          className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
            Suscripción
          </span>
          <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">Ir</span>
        </Link>

        <Link
          href={`/portal-cliente/reporte/${runId}`}
          className="mt-1 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100/80"
        >
          Misma vista con menú Free (izquierda)
        </Link>
      </nav>

      <div className="mt-6 rounded-xl border border-violet-100/90 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <div>
            <p className="text-xs font-bold text-violet-950">Menú Crecimiento</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              El centro replica el portal cliente Free; desde acá entrás al panel Premium y al informe técnico de la corrida.
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] font-medium text-slate-500">Uso mensual (scores vistos)</p>
        <p className="text-sm font-bold tabular-nums text-slate-900">{analysesLabel}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{
              width: `${analysesLimit ? Math.min(100, (analysesUsed / Math.max(1, analysesLimit)) * 100) : 50}%`,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Corte {renewalLabel}</p>
        <Link
          href={`/portal-crecimiento/reporte/${runId}`}
          className="mt-3 block w-full rounded-lg border border-slate-200 bg-white py-2.5 text-center text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Anexo técnico (corrida)
        </Link>
        <Link
          href={`/portal-crecimiento/reporte/${runId}/premium`}
          className="mt-2 block w-full rounded-lg bg-violet-600 py-2.5 text-center text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          Panel Premium
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end pt-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Headphones className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <span>¿Necesitás ayuda? Contactá a nuestro equipo</span>
        </div>
      </div>
    </aside>
  );
}
