'use client';

import { useMemo, useState } from 'react';
import './agency-stitch-scope.css';

type ProductStatus = 'Publicada' | 'Borrador' | 'En progreso';

type ProductPage = {
  product: string;
  kwds: string[];
  page: string;
  status: ProductStatus;
};

const PRODUCT_PAGES: ProductPage[] = [
  {
    product: 'Agente de Reclamos',
    kwds: ['reclamos envíos IA', 'automatizar reclamos logística'],
    page: '/agentes/reclamos',
    status: 'Publicada',
  },
  {
    product: 'Agente de Seguimiento',
    kwds: ['seguimiento camiones 24/7', 'tracking envíos IA'],
    page: '/agentes/seguimiento',
    status: 'Publicada',
  },
  {
    product: 'Agente de Coordinación',
    kwds: ['coordinar choferes oficina', 'dispatch IA'],
    page: '/agentes/coordinacion',
    status: 'Borrador',
  },
  {
    product: 'SOL completo',
    kwds: ['sistema operativo logística', 'SOL agentes IA'],
    page: '/sol',
    status: 'En progreso',
  },
];

function statusTone(status: ProductStatus) {
  if (status === 'Publicada') {
    return 'bg-secondary-container/50 text-secondary';
  }
  if (status === 'Borrador') {
    return 'bg-tertiary-fixed text-tertiary';
  }
  return 'bg-primary-container/30 text-primary';
}

/**
 * Keywords / Productos — 1 página por producto.
 * Sin HTML Stitch dedicado; alineado al sistema visual Agency.
 */
export function AgencyKeywordsView({ onGoContenido }: { onGoContenido?: () => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'todos' | ProductStatus>('todos');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PRODUCT_PAGES.filter((r) => {
      if (filter !== 'todos' && r.status !== filter) return false;
      if (!needle) return true;
      return [r.product, r.page, ...r.kwds].join(' ').toLowerCase().includes(needle);
    });
  }, [q, filter]);

  const published = PRODUCT_PAGES.filter((r) => r.status === 'Publicada').length;
  const drafts = PRODUCT_PAGES.filter((r) => r.status === 'Borrador').length;
  const inProgress = PRODUCT_PAGES.filter((r) => r.status === 'En progreso').length;

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs mb-1">
            <span className="material-symbols-outlined text-primary text-[20px]">key</span>
            <span className="font-label-micro text-label-micro text-primary uppercase font-bold tracking-wider">
              Visibilidad IA · Productos
            </span>
          </div>
          <h1 className="font-headline-title text-headline-title text-on-surface font-bold">
            Keywords / Productos
          </h1>
          <p className="font-body-default text-body-sm text-on-surface-variant max-w-3xl">
            Abanico de kwds y prompts · 1 página por producto (contenido + fotos).
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          {onGoContenido ? (
            <button
              type="button"
              onClick={onGoContenido}
              className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-surface-container-low text-on-surface font-body-medium text-body-sm"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              Ir a Contenido
            </button>
          ) : null}
          <button
            type="button"
            className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nueva página
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        {(
          [
            ['Publicadas', String(published), 'check_circle', 'bg-secondary-container/40 text-secondary', 'En vivo'],
            ['Borradores', String(drafts), 'edit_note', 'bg-tertiary-fixed text-tertiary', 'Pendientes'],
            ['En progreso', String(inProgress), 'pending', 'bg-primary-container/20 text-primary', 'En producción'],
          ] as const
        ).map(([label, value, icon, tone, hint]) => (
          <div
            key={label}
            className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">{label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </div>
            </div>
            <div className="font-headline-metric text-headline-metric text-on-surface">{value}</div>
            <span className="font-body-sm text-[12px] text-outline mt-1">{hint}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">web</span>
            <h2 className="font-headline-title text-body-medium font-bold text-on-surface">Páginas objetivo</h2>
            <span className="font-label-micro text-label-micro text-outline bg-surface-container-low px-2 py-0.5 rounded-full">
              {rows.length}
            </span>
          </div>
          <div className="flex items-center gap-space-sm flex-wrap">
            <div className="relative flex items-center bg-surface-container-low rounded-lg px-space-sm py-1.5">
              <span className="material-symbols-outlined text-outline text-[18px]">search</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar producto, kwd, URL…"
                className="bg-transparent outline-none px-2 font-body-sm text-body-sm text-on-surface min-w-[200px]"
              />
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl">
              {(
                [
                  ['todos', 'Todos'],
                  ['Publicada', 'Publicadas'],
                  ['Borrador', 'Borradores'],
                  ['En progreso', 'En progreso'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={
                    filter === key
                      ? 'px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-primary font-body-medium text-body-sm shadow-sm'
                      : 'px-space-md py-1.5 rounded-lg text-on-surface-variant font-body-medium text-body-sm'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase tracking-wider">
                <th className="px-space-md py-2.5 rounded-l-lg font-semibold">Producto</th>
                <th className="px-space-md py-2.5 font-semibold">Keywords / prompts</th>
                <th className="px-space-md py-2.5 font-semibold">URL</th>
                <th className="px-space-md py-2.5 rounded-r-lg font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.product}
                  className="hover:bg-surface-container-low/50 transition-colors border-b border-outline-variant/20"
                >
                  <td className="px-space-md py-3 font-body-medium text-body-sm text-on-surface font-semibold">
                    {r.product}
                  </td>
                  <td className="px-space-md py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.kwds.map((k) => (
                        <span
                          key={k}
                          className="font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-space-md py-3 font-metric-tabular text-[12px] text-outline">{r.page}</td>
                  <td className="px-space-md py-3">
                    <span
                      className={`font-label-micro text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusTone(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-space-md py-10 text-center font-body-sm text-outline">
                    Sin páginas para este filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
