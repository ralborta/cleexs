'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './agency-stitch-scope.css';

type AgentRow = {
  id: string;
  name: string;
  page: string;
  contentType: string;
  sovHits: number;
  readiness: number;
  status: string;
  source: 'existente' | 'teo';
};

const STORAGE_KEY = 'portal_empliados_contenido_v1';

const SEED: AgentRow[] = [
  { id: '1', name: 'Agente de Reclamos', page: '/agentes/reclamos', contentType: 'Landing producto', sovHits: 9, readiness: 86, status: 'Indexada', source: 'existente' },
  { id: '2', name: 'Agente de Seguimiento', page: '/agentes/seguimiento', contentType: 'Landing producto', sovHits: 7, readiness: 81, status: 'Indexada', source: 'existente' },
  { id: '3', name: 'Agente de Coordinación', page: '/agentes/coordinacion', contentType: 'Borrador Teo', sovHits: 3, readiness: 54, status: 'Borrador', source: 'teo' },
  { id: '4', name: 'Agente de Atención clientes', page: '/agentes/atencion', contentType: 'Landing producto', sovHits: 5, readiness: 72, status: 'Indexada', source: 'existente' },
  { id: '5', name: 'Agente de Planificación viajes', page: '/agentes/planificacion', contentType: 'Outline Teo', sovHits: 1, readiness: 28, status: 'Pendiente', source: 'teo' },
  { id: '6', name: 'Agente de Documentación', page: '/agentes/documentacion', contentType: 'Guía técnica', sovHits: 4, readiness: 68, status: 'Indexada', source: 'existente' },
  { id: '7', name: 'Agente de Alertas operativas', page: '/agentes/alertas', contentType: 'Pieza Teo', sovHits: 6, readiness: 74, status: 'Indexada', source: 'teo' },
  { id: '8', name: 'Agente de Reportes', page: '/agentes/reportes', contentType: 'Borrador Teo', sovHits: 2, readiness: 41, status: 'Borrador', source: 'teo' },
];

function loadRows(): AgentRow[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as AgentRow[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch {
    return SEED;
  }
}

/**
 * Contenido = HTML Stitch (contenido-visibilidad-ia.html) + estado editable (localStorage).
 */
export function AgencyContenidoView() {
  const [tab, setTab] = useState<'existente' | 'teo'>('existente');
  const [rows, setRows] = useState<AgentRow[]>(SEED);
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setRows(loadRows());
  }, []);

  const persist = useCallback((next: AgentRow[]) => {
    setRows(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.source !== tab) return false;
      if (!q.trim()) return true;
      const n = q.trim().toLowerCase();
      return r.name.toLowerCase().includes(n) || r.page.toLowerCase().includes(n) || r.contentType.toLowerCase().includes(n);
    });
  }, [rows, tab, q]);

  const indexed = rows.filter((r) => r.status === 'Indexada').length;
  const teoCount = rows.filter((r) => r.source === 'teo').length;
  const faqCount = 4;

  async function syncCms() {
    setSyncing(true);
    setMsg(null);
    await new Promise((r) => setTimeout(r, 900));
    const bumped = rows.map((r) =>
      r.source === 'existente' && r.status !== 'Indexada'
        ? { ...r, status: 'Indexada', readiness: Math.min(95, r.readiness + 8) }
        : r
    );
    persist(bumped);
    setMsg('CMS / sitemap sincronizado · indexación actualizada');
    setSyncing(false);
    window.setTimeout(() => setMsg(null), 2500);
  }

  function promote(id: string) {
    persist(
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              status: r.status === 'Indexada' ? 'Indexada' : 'Indexada',
              readiness: Math.min(95, r.readiness + 12),
              sovHits: r.sovHits + 1,
            }
          : r
      )
    );
  }

  function sendToTeo(id: string) {
    persist(
      rows.map((r) =>
        r.id === id
          ? { ...r, source: 'teo', contentType: 'Cola Teo', status: r.status === 'Indexada' ? 'Borrador' : r.status }
          : r
      )
    );
    setTab('teo');
  }

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">auto_stories</span>
            <span className="font-label-micro text-label-micro text-primary uppercase font-bold tracking-wider">
              Visibilidad IA · Catálogo Digital
            </span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">
            Gestión de Contenido para Visibilidad IA
          </h1>
          <p className="font-body-default text-body-default text-on-surface-variant max-w-3xl">
            Separá el contenido publicado del sitio web de lo generado por Teo y supervisá su indexación en motores LLM.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => void syncCms()}
            disabled={syncing}
            className="flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-medium text-body-sm disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${syncing ? 'animate-spin' : ''}`}>sync</span>
            <span>{syncing ? 'Sincronizando…' : 'Sincronizar CMS / sitemap'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('teo')}
            className="flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            <span>Nueva pieza Teo</span>
          </button>
        </div>
      </div>

      {msg ? (
        <div className="flex items-center gap-space-sm px-space-md py-2.5 rounded-xl bg-secondary-container/30 text-on-secondary-container font-body-sm">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {msg}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['existente', 'Ya existente'],
            ['teo', 'Generado por Teo'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? 'px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm font-semibold shadow-sm'
                : 'px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-body-medium text-body-sm'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
          <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">
            {tab === 'teo' ? 'Piezas Teo' : 'Páginas existentes'}
          </span>
          <div className="font-headline-metric text-headline-metric font-bold text-on-surface mt-space-xs">
            {rows.filter((r) => r.source === tab).length}
          </div>
          <p className="font-body-sm text-body-sm text-outline mt-1">
            {tab === 'teo' ? 'Borradores + publicados' : 'En el CMS / sitio'}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
          <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">FAQ IA</span>
          <div className="font-headline-metric text-headline-metric font-bold text-on-surface mt-space-xs">{faqCount}</div>
          <p className="font-body-sm text-body-sm text-outline mt-1">Hubs temáticos · Teo {teoCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
          <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">Indexadas</span>
          <div className="font-headline-metric text-headline-metric font-bold text-secondary mt-space-xs">{indexed}</div>
          <p className="font-body-sm text-body-sm text-outline mt-1">GSC + bots IA</p>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <h2 className="font-headline-title text-headline-title text-on-surface">
              {tab === 'teo' ? 'Cola Teo' : 'Agentes · Contenido Existente'}
            </h2>
            <p className="font-body-sm text-body-sm text-outline">Hits SOV, readiness y estado de indexación editables</p>
          </div>
          <div className="relative flex items-center bg-surface-container-low rounded-lg px-2.5 py-1.5">
            <span className="material-symbols-outlined text-outline text-[18px] mr-1.5">search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar agente o página…"
              className="bg-transparent border-none outline-none font-body-sm text-body-sm text-on-surface w-44"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase tracking-wider">
                <th className="py-3 px-space-md rounded-l-lg">Agente / Página</th>
                <th className="py-3 px-space-md">Tipo</th>
                <th className="py-3 px-space-md text-right">Hits SOV</th>
                <th className="py-3 px-space-md text-right">Readiness</th>
                <th className="py-3 px-space-md">Origen</th>
                <th className="py-3 px-space-md">Index</th>
                <th className="py-3 px-space-md text-right rounded-r-lg">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3.5 px-space-md">
                    <div className="flex flex-col">
                      <span className="font-body-medium font-semibold text-on-surface">{r.name}</span>
                      <span className="font-mono text-[11px] text-outline">{r.page}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-space-md font-body-sm text-on-surface-variant">{r.contentType}</td>
                  <td className="py-3.5 px-space-md text-right font-metric-tabular font-semibold">{r.sovHits}</td>
                  <td className="py-3.5 px-space-md text-right">
                    <span
                      className={`font-metric-tabular font-semibold ${
                        r.readiness >= 70 ? 'text-secondary' : r.readiness >= 45 ? 'text-tertiary' : 'text-error'
                      }`}
                    >
                      {r.readiness}%
                    </span>
                  </td>
                  <td className="py-3.5 px-space-md">
                    <span
                      className={
                        r.source === 'teo'
                          ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-semibold'
                          : 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold'
                      }
                    >
                      {r.source === 'teo' ? 'Teo' : 'Existente'}
                    </span>
                  </td>
                  <td className="py-3.5 px-space-md">
                    <span
                      className={
                        r.status === 'Indexada'
                          ? 'font-label-micro text-[11px] px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container font-semibold'
                          : r.status === 'Borrador'
                            ? 'font-label-micro text-[11px] px-2.5 py-1 rounded-full bg-tertiary-fixed/50 text-tertiary font-semibold'
                            : 'font-label-micro text-[11px] px-2.5 py-1 rounded-full bg-surface-container text-outline font-semibold'
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-space-md text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Marcar indexada / +hits"
                        onClick={() => promote(r.id)}
                        className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined text-[18px]">publish</span>
                      </button>
                      {r.source === 'existente' ? (
                        <button
                          type="button"
                          title="Enviar a Teo"
                          onClick={() => sendToTeo(r.id)}
                          className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container"
                        >
                          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        </button>
                      ) : null}
                      <a
                        href={`https://empliados.net${r.page}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container"
                        title="Abrir"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-primary-fixed/30 p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div className="flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-primary text-[22px]">lightbulb</span>
          <div>
            <h3 className="font-headline-title text-body-medium font-bold text-on-surface">
              Sugerencia de Teo para optimizar citas en ChatGPT Search
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Priorizá piezas con readiness &lt; 50% y publicá FAQ estructurada por agente para subir hits SOV.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab('teo')}
          className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm shrink-0"
        >
          Ir a cola Teo
        </button>
      </div>
    </div>
  );
}
