'use client';

import { useEffect, useMemo, useState } from 'react';
import './llm-visibility-stitch-scope.css';

type Segment = 'todos' | 'nomina' | 'liquidacion' | 'compliance';
type Tab = 'overview' | 'prompts' | 'benchmark' | 'historial' | 'config';
type Mention = 'Top 1 Recomendado' | 'Top 2' | 'Top 3' | 'No citado';

type PromptRow = {
  id: string;
  prompt: string;
  category: string;
  mention: Mention;
  models: string[];
  competitor: string;
  sentiment: string;
  action: string;
};

type RunHistory = {
  id: number;
  at: string;
  status: 'ok' | 'running' | 'failed';
  pria: number;
  top3: number;
  prompts: number;
  note: string;
};

const ALL_MODELS = ['GPT-4o', 'Claude 3.5', 'Perplexity', 'Gemini 1.5'] as const;

const PROMPTS_SEED: PromptRow[] = [
  {
    id: 'p1',
    prompt: 'cuál es el software más fácil para liquidar sueldos pyme en argentina',
    category: 'Liquidación PyME',
    mention: 'Top 1 Recomendado',
    models: ['GPT-4o', 'Claude', 'Perplexity'],
    competitor: 'Nubox',
    sentiment: 'Favorable (92%)',
    action: 'Dominado',
  },
  {
    id: 'p2',
    prompt: 'alternativas modernas a bejerman para sueldos',
    category: 'Migración Bejerman',
    mention: 'Top 2',
    models: ['GPT-4o', 'Claude'],
    competitor: 'Bejerman',
    sentiment: 'Comparativa',
    action: 'Reforzar vs Bejerman',
  },
  {
    id: 'p3',
    prompt: 'cómo automatizar recibos de sueldo digitales f931',
    category: 'Compliance AFIP',
    mention: 'Top 3',
    models: ['Perplexity', 'Gemini'],
    competitor: 'Rex+',
    sentiment: 'Neutral',
    action: 'Generar contenido AFIP LSD',
  },
  {
    id: 'p4',
    prompt: 'comparativa software nómina pyme argentina 2025',
    category: 'Liquidación PyME',
    mention: 'Top 1 Recomendado',
    models: ['GPT-4o', 'Claude', 'Gemini'],
    competitor: 'Ninguno',
    sentiment: 'Favorable (88%)',
    action: 'Dominado',
  },
  {
    id: 'p5',
    prompt: 'mejor software sueldos argentina cct',
    category: 'Compliance AR',
    mention: 'No citado',
    models: [],
    competitor: 'Bejerman',
    sentiment: 'Neutral',
    action: 'Actualizar Blog CCT',
  },
  {
    id: 'p6',
    prompt: 'liquidación sueldos pymes uocra/comercio',
    category: 'Liquidación PyME',
    mention: 'Top 1 Recomendado',
    models: ['Claude', 'Perplexity'],
    competitor: 'Zetech',
    sentiment: 'Favorable (90%)',
    action: 'Mantener',
  },
];

const RANKING = [
  {
    rank: 1,
    name: 'Empliados',
    sub: 'Marca auditada',
    sov: 61.1,
    score: 74.2,
    highlight: true,
    engines: [
      { n: 'GPT-4o', p: 68 },
      { n: 'Claude', p: 72 },
      { n: 'Perplexity', p: 44 },
    ],
  },
  { rank: 2, name: 'Bejerman', sub: 'Thomson Reuters', sov: 58.4, score: 69.8, highlight: false, engines: [] as { n: string; p: number }[] },
  { rank: 3, name: 'Nubox', sub: 'Nómina LatAm', sov: 42.0, score: 52.1, highlight: false, engines: [] as { n: string; p: number }[] },
  { rank: 4, name: 'Rex+', sub: 'Payroll', sov: 36.5, score: 48.4, highlight: false, engines: [] as { n: string; p: number }[] },
  { rank: 5, name: 'Zetech', sub: 'TuRecibo', sov: 21.2, score: 38.0, highlight: false, engines: [] as { n: string; p: number }[] },
];

const ALERTS_SEED = [
  {
    id: 'a1',
    tone: 'warn' as const,
    title: 'Nuevo competidor',
    body: 'Workana Payroll detectado por primera vez en 3 prompts de Perplexity.',
    when: 'Hoy',
  },
  {
    id: 'a2',
    tone: 'bad' as const,
    title: 'Caída posicional · Run #48',
    body: '“mejor software sueldos argentina cct”: bajó de Top 2 a Top 5 en ChatGPT-4o.',
    when: 'Última corrida',
  },
  {
    id: 'a3',
    tone: 'ok' as const,
    title: 'Victoria de citación',
    body: 'Empliados recomendado como opción #1 en Claude 3.5 para liquidación PyME UOCRA/comercio.',
    when: 'Ayer',
  },
];

const HISTORY_SEED: RunHistory[] = [
  {
    id: 48,
    at: '2026-03-12 09:14',
    status: 'ok',
    pria: 74.2,
    top3: 61.1,
    prompts: 18,
    note: 'EMPLIADOS_v1 · 4 LLMs',
  },
  {
    id: 47,
    at: '2026-03-05 10:02',
    status: 'ok',
    pria: 67.4,
    top3: 52.7,
    prompts: 18,
    note: 'EMPLIADOS_v1 · baseline WoW',
  },
  {
    id: 46,
    at: '2026-02-26 11:40',
    status: 'ok',
    pria: 64.1,
    top3: 49.0,
    prompts: 16,
    note: 'EMPLIADOS_v0.9',
  },
];

function mentionClass(m: Mention) {
  if (m === 'Top 1 Recomendado') return 'pill-ok';
  if (m === 'No citado') return 'pill-bad';
  return 'pill-teal';
}

function modelMatches(rowModels: string[], selected: Set<string>) {
  if (selected.size === 0 || selected.size === ALL_MODELS.length) return true;
  return rowModels.some((rm) =>
    [...selected].some((s) => rm.toLowerCase().includes(s.split(' ')[0]!.toLowerCase().replace('gpt-4o', 'gpt')) || s.toLowerCase().includes(rm.toLowerCase()) || (rm === 'Claude' && s.includes('Claude')) || (rm === 'Gemini' && s.includes('Gemini')) || (rm === 'GPT-4o' && s.includes('GPT')))
  );
}

function exportPromptsCsv(rows: PromptRow[]) {
  const header = [
    'prompt',
    'categoria',
    'mencion_empliados',
    'modelos',
    'top_competidor',
    'sentimiento',
    'accion',
  ];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        `"${r.prompt.replace(/"/g, '""')}"`,
        `"${r.category}"`,
        `"${r.mention}"`,
        `"${r.models.join(' | ')}"`,
        `"${r.competitor}"`,
        `"${r.sentiment}"`,
        `"${r.action}"`,
      ].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cleexs-empliados-v1-prompts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const coords = points
    .map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * 120;
      const y = 24 - ((v - min) / span) * 20;
      return `${x},${y}`;
    })
    .join(' ');
  const last = points[points.length - 1] ?? 0;
  const lastY = 24 - ((last - min) / span) * 20;
  return (
    <svg className="spark mt-2" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="llmSpark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00f2fe" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,28 ${coords} 120,28`} fill="url(#llmSpark)" />
      <polyline points={coords} fill="none" stroke="#00f2fe" strokeWidth="1.8" />
      <circle cx="120" cy={lastY} r="2.2" fill="#00f2fe" />
    </svg>
  );
}

/**
 * Port fiel Stitch: Cleexs LLM Visibility Dashboard
 * Proyecto: projects/4675951797588718112 · pantalla Cleexs · Visibilidad Empliados
 * UI funcional (demo piloto): filtros, corridas, CSV, historial, config local.
 */
export function AgencyLlmVisibilityView() {
  const [tab, setTab] = useState<Tab>('overview');
  const [segment, setSegment] = useState<Segment>('todos');
  const [models, setModels] = useState<Set<string>>(() => new Set(ALL_MODELS));
  const [prompts, setPrompts] = useState(PROMPTS_SEED);
  const [alerts, setAlerts] = useState(ALERTS_SEED);
  const [history, setHistory] = useState(HISTORY_SEED);
  const [runId, setRunId] = useState(48);
  const [pria, setPria] = useState(74.2);
  const [top3, setTop3] = useState(61.1);
  const [spark, setSpark] = useState([61, 64, 67, 70, 74.2]);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [cfgAlertDrop, setCfgAlertDrop] = useState(true);
  const [cfgAlertNewComp, setCfgAlertNewComp] = useState(true);
  const [cfgWeeklyMail, setCfgWeeklyMail] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(t);
  }, [flash]);

  const rows = useMemo(() => {
    const bySeg = (() => {
      if (segment === 'todos') return prompts;
      if (segment === 'nomina') {
        return prompts.filter((r) => r.category.includes('Liquidación') || r.category.includes('Migración'));
      }
      if (segment === 'liquidacion') {
        return prompts.filter((r) => r.category.includes('Liquidación'));
      }
      return prompts.filter((r) => r.category.includes('Compliance'));
    })();
    return bySeg.filter((r) => modelMatches(r.models, models));
  }, [segment, prompts, models]);

  const coveragePct = useMemo(() => {
    const cited = prompts.filter((p) => p.mention !== 'No citado').length;
    return Math.round((cited / Math.max(prompts.length, 1)) * 1000) / 10;
  }, [prompts]);

  function toggleModel(m: string) {
    setModels((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  function startRun(source: 'header' | 'table') {
    if (running) return;
    setRunning(true);
    setFlash(source === 'header' ? 'Corrida encolada…' : 'Análisis EMPLIADOS_v1 en curso…');
    const nextId = runId + 1;
    setHistory((h) => [
      {
        id: nextId,
        at: new Date().toISOString().slice(0, 16).replace('T', ' '),
        status: 'running',
        pria,
        top3,
        prompts: prompts.length,
        note: 'EMPLIADOS_v1 · en proceso',
      },
      ...h,
    ]);
    setTab('historial');

    window.setTimeout(() => {
      const deltaPria = Math.round((Math.random() * 2.4 + 0.4) * 10) / 10;
      const deltaTop3 = Math.round((Math.random() * 3.2 + 0.6) * 10) / 10;
      const newPria = Math.min(99, Math.round((pria + deltaPria) * 10) / 10);
      const newTop3 = Math.min(99, Math.round((top3 + deltaTop3) * 10) / 10);
      setPria(newPria);
      setTop3(newTop3);
      setSpark((s) => [...s.slice(-4), newPria]);
      setRunId(nextId);
      setHistory((h) =>
        h.map((row) =>
          row.id === nextId
            ? {
                ...row,
                status: 'ok',
                pria: newPria,
                top3: newTop3,
                note: 'EMPLIADOS_v1 · 4 LLMs · demo',
              }
            : row
        )
      );
      setAlerts((a) => [
        {
          id: `a-${nextId}`,
          tone: 'ok',
          title: `Corrida #${nextId} lista`,
          body: `PRIA ${newPria} · Top3 ${newTop3}% · set EMPLIADOS_v1 (${prompts.length} prompts).`,
          when: 'Ahora',
        },
        ...a,
      ]);
      setRunning(false);
      setFlash(`Corrida #${nextId} completada · PRIA ${newPria}`);
      setTab('overview');
    }, 1600);
  }

  function addPrompt() {
    const text = draftPrompt.trim();
    if (!text) {
      setFlash('Escribí un prompt para agregar al set.');
      return;
    }
    setPrompts((p) => [
      {
        id: `p-${Date.now()}`,
        prompt: text,
        category: 'Liquidación PyME',
        mention: 'No citado',
        models: [],
        competitor: '—',
        sentiment: 'Pendiente',
        action: 'Correr análisis',
      },
      ...p,
    ]);
    setDraftPrompt('');
    setEditing(false);
    setFlash('Prompt agregado a EMPLIADOS_v1 (congelá versión antes de prod).');
    setTab('prompts');
  }

  return (
    <div className="llm-vis -mx-2 sm:-mx-4 rounded-2xl p-space-md sm:p-space-lg space-y-5">
      {flash ? (
        <div
          className="rounded-xl px-4 py-2 font-body-sm text-body-sm text-frost"
          style={{ background: 'rgba(0,242,254,.12)', border: '1px solid rgba(0,242,254,.35)' }}
          role="status"
        >
          {flash}
        </div>
      ) : null}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center glow-cyan">
              <span className="material-symbols-outlined text-on-primary text-[18px]">auto_awesome</span>
            </div>
            <div>
              <div className="font-headline-md text-headline-md text-frost tracking-tight">Cleexs</div>
              <div className="font-label-mono-sm text-label-mono-sm text-muted">Intelligence</div>
            </div>
          </div>
          <div className="btn-ghost px-3 py-1.5 inline-flex items-center gap-1.5 font-body-sm text-body-sm">
            Piloto Empliados (AR / LatAm)
          </div>
          <span className="pill-teal">Motor: Premium · PRIA</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              ['overview', 'Overview'],
              ['prompts', 'Prompts & Intent'],
              ['benchmark', 'Benchmark Competitivo'],
              ['historial', 'Historial & Corridas'],
              ['config', 'Configuración'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? 'px-3 py-1.5 rounded-lg font-body-sm text-body-sm text-cyan'
                  : 'px-3 py-1.5 rounded-lg font-body-sm text-body-sm text-muted'
              }
              style={tab === id ? { borderBottom: '2px solid #00f2fe' } : undefined}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={running}
            onClick={() => startRun('header')}
            className="btn-primary px-4 py-2 font-body-sm text-body-sm inline-flex items-center gap-1"
            style={running ? { opacity: 0.6, cursor: 'wait' } : undefined}
          >
            <span className="material-symbols-outlined text-[18px]">{running ? 'hourglass_top' : 'play_arrow'}</span>
            {running ? 'Corriendo…' : 'Nueva Corrida'}
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-headline-lg text-headline-lg text-frost tracking-tight">Cleexs Intelligence</h1>
              <span className="pill-model">PILOTO EMPLIADOS</span>
              <span className="pill-teal font-mono"># EMPLIADOS_v1</span>
            </div>
            <p className="font-body-sm text-body-sm text-muted max-w-4xl">
              Cleexs Intelligence: Empliados · Soluciones: Software de liquidación de sueldos, compliance laboral y
              gestión de nómina para PyMEs · Audiencia: RRHH &amp; Finanzas · Mercado: Argentina / LatAm (Cono Sur) ·
              Set de Prompts: EMPLIADOS_v1 ({prompts.length} prompts activos)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill-ok">
              Corrida #{runId} · {running ? 'procesando…' : '100% procesado'}
            </span>
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 font-body-sm text-body-sm"
              onClick={() => {
                setTab('historial');
                setFlash('Auditoría: abrí Historial para ver evidencia por corrida.');
              }}
            >
              Auditoría de Inferencia
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              ['todos', `Todos (${prompts.length})`],
              ['nomina', 'Nómina PyME'],
              ['liquidacion', 'Liquidación Sueldos'],
              ['compliance', 'Compliance AR'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSegment(id)}
              className={segment === id ? 'pill-teal' : 'btn-ghost px-2.5 py-1 font-label-mono-sm text-label-mono-sm'}
            >
              {label}
            </button>
          ))}
          <span className="text-dim font-label-mono-sm text-label-mono-sm mx-1">|</span>
          {ALL_MODELS.map((m) => {
            const on = models.has(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleModel(m)}
                className={on ? 'pill-model' : 'btn-ghost px-2.5 py-1 font-label-mono-sm text-label-mono-sm'}
                style={!on ? { opacity: 0.45 } : undefined}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {(tab === 'overview' || tab === 'prompts' || tab === 'benchmark') && (
        <>
          {tab !== 'prompts' ? (
            <div className="grid grid-kpi">
              <div className="glass rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <span className="font-label-mono-sm text-label-mono-sm text-muted uppercase tracking-wider">
                    Cleexs Score (PRIA)
                  </span>
                  <span className="pill-ok">+6.8 pts</span>
                </div>
                <div className="font-metric-display text-metric-display text-frost tabular-nums mt-1">
                  {pria.toFixed(1)} <span className="text-muted text-body-md font-body-md">/ 100</span>
                </div>
                <Sparkline points={spark} />
                <p className="font-body-sm text-body-sm text-dim mt-2">
                  Fórmula fija: presencia ponderada por ranking y coherencia contextual
                </p>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <span className="font-label-mono-sm text-label-mono-sm text-muted uppercase tracking-wider">
                    Top 3 % Visibilidad
                  </span>
                  <span className="pill-ok">+8.4% MoM</span>
                </div>
                <div className="font-metric-display text-metric-display text-cyan tabular-nums mt-1">
                  {top3.toFixed(1)}%
                </div>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="flex justify-between font-label-mono-sm text-label-mono-sm text-muted mb-1">
                      <span>Claude 3.5</span>
                      <span>72.2%</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: '72.2%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-label-mono-sm text-label-mono-sm text-muted mb-1">
                      <span>ChatGPT-4o</span>
                      <span>{top3.toFixed(1)}%</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.min(top3, 100)}%`, background: '#8b5cf6' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <span className="font-label-mono-sm text-label-mono-sm text-muted uppercase tracking-wider">
                    Competidores Detectados
                  </span>
                  <span className="pill-model">+2 nuevas</span>
                </div>
                <div className="font-metric-display text-metric-display text-frost tabular-nums mt-1">
                  14 <span className="text-muted text-body-md font-body-md">marcas</span>
                </div>
                <p className="font-body-sm text-body-sm text-muted mt-2">
                  Principales: Bejerman (58.4%), Nubox (42%). Nuevos: Workana Payroll, Factorial.
                </p>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <span className="font-label-mono-sm text-label-mono-sm text-muted uppercase tracking-wider">
                    Cobertura de Dolor / Intención
                  </span>
                  <span className="pill-ok">{coveragePct}%</span>
                </div>
                <div className="font-metric-display text-metric-display text-frost tabular-nums mt-1">
                  {coveragePct}%
                </div>
                <p className="font-body-sm text-body-sm text-muted mt-2">
                  {prompts.filter((p) => p.mention !== 'No citado').length}/{prompts.length} prompts cubiertos ·{' '}
                  <span className="text-rose">
                    {prompts.filter((p) => p.mention === 'No citado').length} zona crítica
                  </span>
                </p>
              </div>
            </div>
          ) : null}

          {tab !== 'prompts' ? (
            <div className="grid grid-main">
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan text-[22px]">leaderboard</span>
                  <h2 className="font-headline-md text-headline-md text-frost">
                    Visibilidad de Marca vs Competidores Clave
                  </h2>
                </div>
                <div className="space-y-2">
                  {RANKING.map((r) => (
                    <div
                      key={r.name}
                      className="rounded-xl p-3"
                      style={
                        r.highlight
                          ? { border: '1px solid rgba(0,242,254,.4)', background: 'rgba(0,242,254,.08)' }
                          : { border: '1px solid rgba(255,255,255,.08)' }
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-label-code text-label-code text-muted">#{r.rank}</span>
                          <div className="min-w-0">
                            <div className="font-headline-md text-body-md text-frost truncate">
                              {r.name}
                              {r.highlight ? ` · PRIA ${pria.toFixed(1)}` : ''}
                            </div>
                            <div className="font-label-mono-sm text-label-mono-sm text-dim">{r.sub}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-label-code text-label-code text-cyan tabular-nums">
                            {r.highlight ? top3.toFixed(1) : r.sov}% SOV
                          </div>
                          <div className="font-label-mono-sm text-label-mono-sm text-muted">
                            PRIA {r.highlight ? pria.toFixed(1) : r.score}
                          </div>
                        </div>
                      </div>
                      {r.engines.length > 0 ? (
                        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                          {r.engines.map((e) => (
                            <div key={e.n}>
                              <div className="flex justify-between font-label-mono-sm text-label-mono-sm text-muted mb-1">
                                <span>{e.n}</span>
                                <span>{e.p}%</span>
                              </div>
                              <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${e.p}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div
                    className="rounded-lg p-3"
                    style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)' }}
                  >
                    <div className="font-label-mono-sm text-label-mono-sm text-emerald uppercase">
                      Donde Empliados GANA
                    </div>
                    <p className="font-body-sm text-body-sm text-muted mt-1">Liquidación de nómina PyME</p>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{ background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.25)' }}
                  >
                    <div className="font-label-mono-sm text-label-mono-sm text-violet uppercase">
                      Lidera la competencia
                    </div>
                    <p className="font-body-sm text-body-sm text-muted mt-1">Compliance corporativo multicountry</p>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet text-[22px]">notifications_active</span>
                    <h2 className="font-headline-md text-headline-md text-frost">Centro de Alertas &amp; Cambios</h2>
                  </div>
                  {alerts.length > 0 ? (
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 font-label-mono-sm text-label-mono-sm"
                      onClick={() => setAlerts([])}
                    >
                      Limpiar
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <p className="font-body-sm text-body-sm text-muted">Sin alertas pendientes.</p>
                  ) : (
                    alerts.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl p-3"
                        style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={a.tone === 'ok' ? 'pill-ok' : a.tone === 'bad' ? 'pill-bad' : 'pill-warn'}>
                            {a.title}
                          </span>
                          <button
                            type="button"
                            className="font-label-mono-sm text-label-mono-sm text-dim"
                            onClick={() => setAlerts((list) => list.filter((x) => x.id !== a.id))}
                          >
                            descartar · {a.when}
                          </button>
                        </div>
                        <p className="font-body-sm text-body-sm text-muted">{a.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {(tab === 'overview' || tab === 'prompts') && (
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="material-symbols-outlined text-cyan text-[22px]">terminal</span>
                  <h2 className="font-headline-md text-headline-md text-frost">
                    Prompts Activos &amp; Rendimiento Detallado
                  </h2>
                  <span className="pill-teal font-mono">Set Activo: EMPLIADOS_v1</span>
                  <span className="font-label-mono-sm text-label-mono-sm text-dim">
                    {rows.length} filas filtradas
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 font-body-sm text-body-sm"
                    onClick={() => {
                      setEditing((v) => !v);
                      setTab('prompts');
                    }}
                  >
                    {editing ? 'Cerrar editor' : 'Editar Set'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 font-body-sm text-body-sm"
                    onClick={() => {
                      exportPromptsCsv(rows);
                      setFlash(`CSV exportado (${rows.length} prompts).`);
                    }}
                  >
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    disabled={running}
                    className="btn-primary px-3 py-1.5 font-body-sm text-body-sm"
                    onClick={() => startRun('table')}
                  >
                    Correr Análisis
                  </button>
                </div>
              </div>

              {editing ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    placeholder="Nuevo prompt controlado (dolor / intención)…"
                    className="flex-1 rounded-lg px-3 py-2 font-body-sm text-body-sm text-frost"
                    style={{
                      background: 'rgba(0,0,0,.35)',
                      border: '1px solid rgba(255,255,255,.12)',
                      outline: 'none',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addPrompt();
                    }}
                  />
                  <button type="button" className="btn-primary px-4 py-2 font-body-sm text-body-sm" onClick={addPrompt}>
                    Agregar al set
                  </button>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-xl">
                <table className="text-left border-collapse min-w-[960px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      {[
                        'Prompt / Intención',
                        'Categoría / Dolor',
                        'Mención Empliados',
                        'Modelos',
                        'Top Competidor',
                        'Sentimiento',
                        'Acción',
                      ].map((h) => (
                        <th
                          key={h}
                          className="py-3 px-3 font-label-mono-sm text-label-mono-sm text-muted uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 px-3 font-body-sm text-body-sm text-muted">
                          Sin prompts para este filtro. Activá más modelos o cambiá el segmento.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr
                          key={r.id}
                          className="row-hover"
                          style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}
                        >
                          <td className="py-3 px-3 font-body-sm text-body-sm text-frost max-w-xs">{r.prompt}</td>
                          <td className="py-3 px-3">
                            <span className="pill-model">{r.category}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={mentionClass(r.mention)}>{r.mention}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {r.models.length ? (
                                r.models.map((m) => (
                                  <span key={m} className="pill-model">
                                    {m}
                                  </span>
                                ))
                              ) : (
                                <span className="text-dim font-label-mono-sm text-label-mono-sm">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-label-code text-label-code text-muted">{r.competitor}</td>
                          <td className="py-3 px-3 font-body-sm text-body-sm text-muted">{r.sentiment}</td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              className="btn-ghost px-2.5 py-1 font-label-mono-sm text-label-mono-sm"
                              onClick={() => {
                                setFlash(`Acción registrada: ${r.action}`);
                                if (r.mention === 'No citado') {
                                  setPrompts((list) =>
                                    list.map((x) =>
                                      x.id === r.id
                                        ? { ...x, mention: 'Top 3', models: ['GPT-4o'], action: 'En pipeline Teo' }
                                        : x
                                    )
                                  );
                                }
                              }}
                            >
                              {r.action}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'historial' ? (
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-headline-md text-headline-md text-frost">Historial &amp; Corridas</h2>
            <button
              type="button"
              disabled={running}
              className="btn-primary px-3 py-1.5 font-body-sm text-body-sm"
              onClick={() => startRun('header')}
            >
              Nueva Corrida
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="text-left border-collapse min-w-[720px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                  {['#', 'Fecha', 'Status', 'PRIA', 'Top3', 'Prompts', 'Nota'].map((h) => (
                    <th key={h} className="py-3 px-3 font-label-mono-sm text-label-mono-sm text-muted uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td className="py-3 px-3 font-label-code text-label-code text-cyan">#{h.id}</td>
                    <td className="py-3 px-3 font-label-mono-sm text-label-mono-sm text-muted">{h.at}</td>
                    <td className="py-3 px-3">
                      <span className={h.status === 'ok' ? 'pill-ok' : h.status === 'running' ? 'pill-warn' : 'pill-bad'}>
                        {h.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-body-sm text-body-sm text-frost tabular-nums">{h.pria.toFixed(1)}</td>
                    <td className="py-3 px-3 font-body-sm text-body-sm text-frost tabular-nums">{h.top3.toFixed(1)}%</td>
                    <td className="py-3 px-3 font-body-sm text-body-sm text-muted">{h.prompts}</td>
                    <td className="py-3 px-3 font-body-sm text-body-sm text-muted">{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'config' ? (
        <div className="glass rounded-xl p-4 space-y-4">
          <h2 className="font-headline-md text-headline-md text-frost">Configuración del piloto</h2>
          <p className="font-body-sm text-body-sm text-muted">
            Set congelado: <span className="text-cyan font-mono">EMPLIADOS_v1</span> · Mercado AR/LatAm · 4 LLMs
          </p>
          {(
            [
              ['Alertar caídas de ranking > 2 posiciones', cfgAlertDrop, setCfgAlertDrop],
              ['Alertar competidor nuevo', cfgAlertNewComp, setCfgAlertNewComp],
              ['Resumen semanal por email (demo)', cfgWeeklyMail, setCfgWeeklyMail],
            ] as const
          ).map(([label, value, setter]) => (
            <label
              key={label}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-3"
              style={{ border: '1px solid rgba(255,255,255,.08)' }}
            >
              <span className="font-body-sm text-body-sm text-frost">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={value}
                onClick={() => {
                  setter(!value);
                  setFlash('Preferencia guardada (local / demo).');
                }}
                className="rounded-full"
                style={{
                  width: 44,
                  height: 26,
                  background: value ? '#00f2fe' : 'rgba(255,255,255,.15)',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: value ? 22 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: value ? '#070a11' : '#f9fafb',
                    transition: 'left .15s',
                  }}
                />
              </button>
            </label>
          ))}
        </div>
      ) : null}

      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(0,242,254,.06)', border: '1px solid rgba(0,242,254,.2)' }}
      >
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-cyan text-[20px]">info</span>
          <div>
            <div className="font-label-mono-sm text-label-mono-sm text-cyan uppercase tracking-wider">
              Disclaimer metodológico Cleexs
            </div>
            <p className="font-body-sm text-body-sm text-muted mt-1">
              Cleexs audita, indexa y mide resultados empíricos objetivos y variaciones posicionales en motores de IA
              generativa (LLMs). No garantiza uplift comercial directo ni conversiones transaccionales fuera de los
              modelos analizados. Datos actuales: demo piloto Stitch (listo para cablear corridas reales).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
