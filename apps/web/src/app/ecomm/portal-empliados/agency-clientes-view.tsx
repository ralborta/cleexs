'use client';

import { useMemo, useState } from 'react';
import './agency-stitch-scope.css';

type ClientRow = {
  email: string;
  wa: string;
  company: string;
  industry: string;
  size: string;
  geo: string;
  product: string;
  enrich: string;
  score: number;
};

const DEMO_ROWS: ClientRow[] = [
  {
    email: 'ops@transporteandino.com',
    wa: '+54 9 11 …',
    company: 'Transporte Andino SA',
    industry: 'Transporte de carga',
    size: '40 unidades',
    geo: 'CABA / GBA',
    product: 'Reclamos + Seguimiento',
    enrich: 'Clearbit · LinkedIn',
    score: 82,
  },
  {
    email: 'ceo@rutasur.com.ar',
    wa: '+54 9 351 …',
    company: 'Ruta Sur Logística',
    industry: '3PL',
    size: '25+ viajes/día',
    geo: 'Córdoba',
    product: 'SOL completo',
    enrich: 'Apollo · manual',
    score: 91,
  },
  {
    email: 'logistica@distribuidorapampa.com',
    wa: '—',
    company: 'Distribuidora Pampa',
    industry: 'Distribución',
    size: '12 depósitos',
    geo: 'Interior AR',
    product: 'Atención clientes',
    enrich: 'Pendiente',
    score: 54,
  },
];

/**
 * Clientes = perfiles firmográficos del portal.
 * No hay HTML Stitch dedicado; se alinea al sistema visual Agency (cards + tabla).
 */
export function AgencyClientesView({ onGoEmail }: { onGoEmail?: () => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'todos' | 'enriquecidos' | 'pendientes'>('todos');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DEMO_ROWS.filter((r) => {
      if (filter === 'enriquecidos' && r.enrich === 'Pendiente') return false;
      if (filter === 'pendientes' && r.enrich !== 'Pendiente') return false;
      if (!needle) return true;
      return [r.company, r.email, r.industry, r.geo, r.product, r.enrich]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [q, filter]);

  const enriched = DEMO_ROWS.filter((r) => r.enrich !== 'Pendiente').length;
  const avgScore = Math.round(DEMO_ROWS.reduce((s, r) => s + r.score, 0) / DEMO_ROWS.length);

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs mb-1">
            <span className="material-symbols-outlined text-primary text-[20px]">group</span>
            <span className="font-label-micro text-label-micro text-primary uppercase font-bold tracking-wider">
              Negocio · CRM
            </span>
          </div>
          <h1 className="font-headline-title text-headline-title text-on-surface font-bold">Clientes</h1>
          <p className="font-body-default text-body-sm text-on-surface-variant max-w-3xl">
            Enriquecimiento firmográfico → segmentación y email personalizado.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          {onGoEmail ? (
            <button
              type="button"
              onClick={onGoEmail}
              className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-surface-container-low text-on-surface font-body-medium text-body-sm"
            >
              <span className="material-symbols-outlined text-[18px]">mail</span>
              Ir a Email
            </button>
          ) : null}
          <button
            type="button"
            className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Nuevo perfil
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        {(
          [
            ['Perfiles', String(DEMO_ROWS.length), 'group', 'bg-primary-container/20 text-primary', 'Demo portal'],
            [
              'Enriquecidos',
              `${enriched} / ${DEMO_ROWS.length}`,
              'auto_awesome',
              'bg-secondary-container/40 text-secondary',
              'Clearbit · Apollo',
            ],
            ['Score medio', String(avgScore), 'target', 'bg-tertiary-fixed text-tertiary', 'Fit Agency'],
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
            <span className="material-symbols-outlined text-primary text-[20px]">table_rows</span>
            <h2 className="font-headline-title text-body-medium font-bold text-on-surface">
              Perfiles enriquecidos
            </h2>
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
                placeholder="Buscar empresa, email, geo…"
                className="bg-transparent outline-none px-2 font-body-sm text-body-sm text-on-surface min-w-[200px]"
              />
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl">
              {(
                [
                  ['todos', 'Todos'],
                  ['enriquecidos', 'Enriquecidos'],
                  ['pendientes', 'Pendientes'],
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
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase tracking-wider">
                <th className="px-space-md py-2.5 rounded-l-lg font-semibold">Empresa</th>
                <th className="px-space-md py-2.5 font-semibold">Contacto</th>
                <th className="px-space-md py-2.5 font-semibold">Industria / tamaño</th>
                <th className="px-space-md py-2.5 font-semibold">Geo</th>
                <th className="px-space-md py-2.5 font-semibold">Agentes</th>
                <th className="px-space-md py-2.5 font-semibold">Enrich</th>
                <th className="px-space-md py-2.5 rounded-r-lg font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email} className="hover:bg-surface-container-low/50 transition-colors border-b border-outline-variant/20">
                  <td className="px-space-md py-3 font-body-medium text-body-sm text-on-surface font-semibold">
                    {r.company}
                  </td>
                  <td className="px-space-md py-3">
                    <div className="font-body-sm text-body-sm text-on-surface">{r.email}</div>
                    <div className="font-body-sm text-[12px] text-outline">{r.wa}</div>
                  </td>
                  <td className="px-space-md py-3">
                    <div className="font-body-sm text-body-sm text-on-surface">{r.industry}</div>
                    <div className="font-body-sm text-[12px] text-outline">{r.size}</div>
                  </td>
                  <td className="px-space-md py-3 font-body-sm text-body-sm text-on-surface-variant">{r.geo}</td>
                  <td className="px-space-md py-3 font-body-sm text-body-sm text-on-surface">{r.product}</td>
                  <td className="px-space-md py-3">
                    <span
                      className={
                        r.enrich === 'Pendiente'
                          ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-semibold'
                          : 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-secondary-container/50 text-secondary font-semibold'
                      }
                    >
                      {r.enrich}
                    </span>
                  </td>
                  <td className="px-space-md py-3 font-metric-tabular text-body-medium font-bold text-on-surface">
                    {r.score}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-space-md py-10 text-center font-body-sm text-outline">
                    Sin perfiles para este filtro.
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
