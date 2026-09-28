'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './agency-stitch-scope.css';

type HubRow = {
  id: string;
  path: string;
  type: string;
  semantics: string;
  posts: number;
  cites: number;
  updated: string;
  crawler: 'OK' | 'Warn' | 'Block';
};

const STORAGE_KEY = 'portal_empliados_hub_llm_v1';
const PUBLIC_HUB = 'https://llm.empliados.net';

const SEED: HubRow[] = [
  { id: '1', path: '/faq/reclamos', type: 'FAQ', semantics: 'Schema FAQPage + HowTo', posts: 12, cites: 8, updated: 'Hoy', crawler: 'OK' },
  { id: '2', path: '/faq/seguimiento', type: 'FAQ', semantics: 'Schema FAQPage', posts: 9, cites: 6, updated: 'Ayer', crawler: 'OK' },
  { id: '3', path: '/articulos', type: 'Artículos', semantics: 'Article + BreadcrumbList', posts: 18, cites: 11, updated: 'Hace 2d', crawler: 'OK' },
  { id: '4', path: '/agentica', type: 'Agentica', semantics: 'Demo flows + JSON-LD', posts: 6, cites: 4, updated: 'Hoy', crawler: 'Warn' },
  { id: '5', path: '/faq/coordinacion', type: 'FAQ', semantics: 'FAQPage draft', posts: 4, cites: 1, updated: 'Hoy', crawler: 'Warn' },
  { id: '6', path: '/llms.txt', type: 'Feed', semantics: 'Índice para crawlers LLM', posts: 1, cites: 3, updated: 'Hoy', crawler: 'OK' },
];

function loadRows(): HubRow[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as HubRow[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch {
    return SEED;
  }
}

/**
 * Hub LLM = HTML Stitch (hub-llm-art-culos-de-ia.html) + estado editable + links públicos.
 */
export function AgencyHubLlmView() {
  const [rows, setRows] = useState<HubRow[]>(SEED);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'todos' | 'faq' | 'art' | 'agent'>('todos');
  const [llmsTxt, setLlmsTxt] = useState(
    `# Empliados LLM Hub\n> SOL · agentes IA logística\n\n## FAQs\n- ${PUBLIC_HUB}/faq/reclamos\n- ${PUBLIC_HUB}/faq/seguimiento\n\n## Artículos\n- ${PUBLIC_HUB}/articulos\n`
  );
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setRows(loadRows());
  }, []);

  const persist = useCallback((next: HubRow[]) => {
    setRows(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'faq' && r.type !== 'FAQ') return false;
      if (filter === 'art' && r.type !== 'Artículos') return false;
      if (filter === 'agent' && r.type !== 'Agentica') return false;
      if (!q.trim()) return true;
      const n = q.trim().toLowerCase();
      return r.path.toLowerCase().includes(n) || r.type.toLowerCase().includes(n) || r.semantics.toLowerCase().includes(n);
    });
  }, [rows, filter, q]);

  const faqs = rows.filter((r) => r.type === 'FAQ').reduce((s, r) => s + r.posts, 0);
  const arts = rows.filter((r) => r.type === 'Artículos').reduce((s, r) => s + r.posts, 0);
  const agentica = rows.filter((r) => r.type === 'Agentica').reduce((s, r) => s + r.posts, 0);
  const health = Math.round(
    (rows.filter((r) => r.crawler === 'OK').length / Math.max(1, rows.length)) * 100
  );

  async function copyLlms() {
    try {
      await navigator.clipboard.writeText(llmsTxt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function refreshCrawler(id: string) {
    persist(
      rows.map((r) =>
        r.id === id
          ? { ...r, crawler: 'OK', cites: r.cites + 1, updated: 'Ahora' }
          : r
      )
    );
    setMsg('Crawler revalidado');
    window.setTimeout(() => setMsg(null), 1800);
  }

  function addFaqHub() {
    const id = String(Date.now());
    persist([
      {
        id,
        path: `/faq/nuevo-${id.slice(-4)}`,
        type: 'FAQ',
        semantics: 'FAQPage draft',
        posts: 1,
        cites: 0,
        updated: 'Ahora',
        crawler: 'Warn',
      },
      ...rows,
    ]);
    setMsg('Nueva ruta FAQ agregada al mapa');
    window.setTimeout(() => setMsg(null), 2000);
  }

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="flex flex-col max-w-3xl">
          <div className="flex items-center gap-space-sm mb-space-xs flex-wrap">
            <h1 className="font-headline-title text-headline-title text-on-surface">
              Hub LLM &amp; Centro de Conocimiento IA
            </h1>
            <div className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-micro text-label-micro font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span>Dominio Activo: llm.empliados.net</span>
            </div>
          </div>
          <p className="font-body-default text-body-sm text-on-surface-variant">
            Gestión de FAQs, artículos estructurados y agentes orientados al rastreo y citación por modelos de lenguaje.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-shrink-0 flex-wrap">
          <a
            href={PUBLIC_HUB}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">open_in_new</span>
            <span className="font-label-micro text-label-micro">Previsualizar Hub Público</span>
          </a>
          <button
            type="button"
            onClick={addFaqHub}
            className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-primary text-on-primary shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="font-label-micro text-label-micro">Nueva ruta FAQ</span>
          </button>
        </div>
      </div>

      {msg ? (
        <div className="flex items-center gap-space-sm px-space-md py-2 rounded-xl bg-secondary-container/30 text-on-secondary-container font-body-sm">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {msg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {(
          [
            ['FAQs', String(faqs), 'hubs temáticos', 'forum'],
            ['Artículos', String(arts), 'llm.empliados.net', 'article'],
            ['Agentica', String(agentica), 'flujos / demos', 'smart_toy'],
            ['Health crawler', `${health}%`, 'rutas OK', 'health_and_safety'],
          ] as const
        ).map(([label, value, hint, icon]) => (
          <div key={label} className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">{label}</span>
              <span className="material-symbols-outlined text-primary text-[18px]">{icon}</span>
            </div>
            <div className="font-headline-metric text-headline-metric font-bold text-on-surface mt-space-sm">{value}</div>
            <p className="font-body-sm text-body-sm text-outline mt-1">{hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <div className="lg:col-span-8 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div>
              <h2 className="font-headline-title text-headline-title text-on-surface">Mapa del Hub &amp; Rutas Estructuradas</h2>
              <p className="font-body-sm text-body-sm text-outline">Paths públicos, semántica y estado de crawler</p>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="relative flex items-center bg-surface-container-low rounded-lg px-2.5 py-1.5">
                <span className="material-symbols-outlined text-outline text-[18px] mr-1.5">search</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar ruta…"
                  className="bg-transparent outline-none font-body-sm text-body-sm w-36"
                />
              </div>
              <div className="flex items-center bg-surface-container-low rounded-lg p-1 gap-1">
                {(
                  [
                    ['todos', 'Todos'],
                    ['faq', 'FAQ'],
                    ['art', 'Artículos'],
                    ['agent', 'Agentica'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    className={
                      filter === k
                        ? 'px-space-sm py-1 rounded-md bg-surface-container-lowest shadow-sm font-label-micro text-label-micro'
                        : 'px-space-sm py-1 rounded-md text-on-surface-variant font-label-micro text-label-micro'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase">
                  <th className="py-3 px-space-md">Ruta / Path LLM</th>
                  <th className="py-3 px-space-md">Tipo</th>
                  <th className="py-3 px-space-md">Semántica</th>
                  <th className="py-3 px-space-md text-right">Posts</th>
                  <th className="py-3 px-space-md text-right">Citas</th>
                  <th className="py-3 px-space-md">Act.</th>
                  <th className="py-3 px-space-md">Crawler</th>
                  <th className="py-3 px-space-md text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3.5 px-space-md">
                      <a
                        href={`${PUBLIC_HUB}${r.path === '/llms.txt' ? '/llms.txt' : r.path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-primary font-semibold"
                      >
                        {r.path}
                      </a>
                    </td>
                    <td className="py-3.5 px-space-md font-body-sm">{r.type}</td>
                    <td className="py-3.5 px-space-md font-body-sm text-on-surface-variant">{r.semantics}</td>
                    <td className="py-3.5 px-space-md text-right font-metric-tabular font-semibold">{r.posts}</td>
                    <td className="py-3.5 px-space-md text-right font-metric-tabular">{r.cites}</td>
                    <td className="py-3.5 px-space-md font-body-sm text-outline">{r.updated}</td>
                    <td className="py-3.5 px-space-md">
                      <span
                        className={
                          r.crawler === 'OK'
                            ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-semibold'
                            : r.crawler === 'Warn'
                              ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-tertiary-fixed/50 text-tertiary font-semibold'
                              : 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-error-container text-error font-semibold'
                        }
                      >
                        {r.crawler}
                      </span>
                    </td>
                    <td className="py-3.5 px-space-md text-right">
                      <button
                        type="button"
                        title="Revalidar crawler"
                        onClick={() => refreshCrawler(r.id)}
                        className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-space-md">
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-title text-body-medium font-bold text-on-surface">
                Configuración y Feed llms.txt
              </h3>
              <span className="material-symbols-outlined text-primary text-[20px]">data_object</span>
            </div>
            <textarea
              rows={8}
              value={llmsTxt}
              onChange={(e) => setLlmsTxt(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-surface-container-low font-mono text-[11px] text-on-surface outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <button
              type="button"
              onClick={() => void copyLlms()}
              className="flex items-center justify-center gap-1 px-space-md py-2 rounded-lg bg-surface-container-high text-on-surface font-body-medium text-body-sm"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              {copied ? 'Copiado' : 'Copiar llms.txt'}
            </button>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-sm">
            <h3 className="font-headline-title text-body-medium font-bold text-on-surface">
              Sugerencias de Optimización IA
            </h3>
            <ul className="flex flex-col gap-2">
              {[
                'Completar BreadcrumbList en /agentica',
                'Publicar FAQ de coordinación (hoy Warn)',
                'Exponer llms.txt en la raíz del dominio',
              ].map((s) => (
                <li key={s} className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">tips_and_updates</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
