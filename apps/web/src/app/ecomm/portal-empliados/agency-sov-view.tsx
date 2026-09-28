'use client';

import { useMemo, useState } from 'react';
import './agency-stitch-scope.css';

type SovRow = {
  prompt: string;
  empliados: boolean;
  rival: string;
  motor: string;
  action: string;
};

const SOV_ROWS: SovRow[] = [
  {
    prompt: 'agentes de IA para logística Argentina',
    empliados: true,
    rival: 'Empliados',
    motor: 'ChatGPT-4o',
    action: 'Consolidar docs',
  },
  {
    prompt: 'automatizar reclamos de envíos con IA',
    empliados: true,
    rival: 'Empliados',
    motor: 'Perplexity',
    action: 'Ampliar FAQ',
  },
  {
    prompt: 'sistema operativo de logística SOL',
    empliados: true,
    rival: 'Empliados',
    motor: 'Gemini',
    action: 'Consolidar docs',
  },
  {
    prompt: 'IA para seguimiento de camiones 24/7',
    empliados: false,
    rival: 'project44',
    motor: 'ChatGPT-4o',
    action: 'Crear pieza Teo',
  },
  {
    prompt: 'agentes IA coordinación choferes y oficina',
    empliados: true,
    rival: 'Empliados',
    motor: 'Claude',
    action: 'Mantener',
  },
  {
    prompt: 'software logística con más de 25 viajes/día',
    empliados: false,
    rival: 'Beetrack',
    motor: 'Perplexity',
    action: 'Comparar + outreach',
  },
  {
    prompt: 'reducir llamadas de seguimiento de envíos',
    empliados: true,
    rival: 'Empliados',
    motor: 'Gemini',
    action: 'Ampliar FAQ',
  },
  {
    prompt: 'empleados virtuales para pymes de transporte',
    empliados: false,
    rival: 'Melonn',
    motor: 'ChatGPT-4o',
    action: 'Crear pieza Teo',
  },
];

const ENGINES = [
  { name: 'ChatGPT (GPT-4o)', pct: 42, bar: 'bg-primary', note: 'Principal generador de menciones orgánicas', dot: 'bg-primary' },
  { name: 'Perplexity AI', pct: 28, bar: 'bg-tertiary', note: 'Alto ratio de citas directas con enlace', dot: 'bg-tertiary' },
  { name: 'Gemini', pct: 18, bar: 'bg-secondary', note: 'Creciendo en prompts operativos', dot: 'bg-secondary' },
  { name: 'Claude', pct: 12, bar: 'bg-outline', note: 'Menos volumen, buena precisión', dot: 'bg-outline' },
];

const COMPETITORS = [
  { rank: 1, name: 'Beetrack', sov: 28, mentions: 14, note: 'Dominio en ruteo', you: false, tone: 'tertiary' as const },
  { rank: 2, name: 'project44', sov: 18, mentions: 9, note: 'Fuerte en visibilidad', you: false, tone: 'neutral' as const },
  { rank: 3, name: 'Empliados (Tú)', sov: 10.2, mentions: 5, note: 'Creciendo en agentes', you: true, tone: 'primary' as const },
  { rank: 4, name: 'Melonn', sov: 8, mentions: 4, note: 'Pymes transporte', you: false, tone: 'neutral' as const },
];

type Filter = 'todos' | 'aparece' | 'gaps';
type Period = '7d' | '30d' | 'q';

/**
 * AI Share of Voice = HTML Stitch (ai-share-of-voice.html) + datos demo Empliados.
 */
export function AgencySovView() {
  const [period, setPeriod] = useState<Period>('7d');
  const [filter, setFilter] = useState<Filter>('todos');

  const wins = SOV_ROWS.filter((r) => r.empliados).length;
  const gaps = SOV_ROWS.length - wins;
  const sovPct = Math.round((wins / 50) * 1000) / 10;

  const filtered = useMemo(() => {
    if (filter === 'aparece') return SOV_ROWS.filter((r) => r.empliados);
    if (filter === 'gaps') return SOV_ROWS.filter((r) => !r.empliados);
    return SOV_ROWS;
  }, [filter]);

  return (
    <div className="agency-stitch flex w-full flex-col">
      <div className="relative w-full">
        {/* Header — Stitch */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md mb-space-lg">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline-title text-headline-title font-bold text-on-surface tracking-tight">
                AI Share of Voice (SOV)
              </span>
              <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-secondary-container/30 text-on-secondary-container font-label-micro text-label-micro font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                Semana 42
              </span>
            </div>
            <p className="font-body-default text-body-sm text-on-surface-variant mt-0.5">
              Medición semanal de presencia de marca en motores de IA generativa (ChatGPT, Gemini, Perplexity, Claude).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl shadow-sm">
              {(
                [
                  ['7d', '7 días'],
                  ['30d', '30 días'],
                  ['q', 'Trimestre'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className={
                    period === key
                      ? 'px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-micro text-label-micro shadow-sm transition-all'
                      : 'px-space-md py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-micro text-label-micro transition-all'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="flex items-center gap-space-xs px-space-md py-2 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-micro text-label-micro rounded-xl shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">download</span>
              <span>Exportar reporte</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-space-xs px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary font-label-micro text-label-micro rounded-xl shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Nuevo prompt</span>
            </button>
          </div>
        </div>

        {/* KPI band — Stitch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between transition-all hover:shadow-md group">
            <div className="flex items-center justify-between">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">SOV Actual</span>
              <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">pie_chart</span>
              </div>
            </div>
            <div className="my-space-sm flex items-baseline gap-space-sm">
              <span className="font-headline-metric text-headline-metric font-bold text-on-surface">{sovPct}%</span>
              <span className="inline-flex items-center font-badge-label text-badge-label text-secondary bg-secondary-fixed/50 px-1.5 py-0.5 rounded">
                <span className="material-symbols-outlined text-[14px] mr-0.5">trending_up</span>
                +1.4 pp
              </span>
            </div>
            <div className="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
              <span>
                {wins} menciones / 50 prompts
              </span>
              <span className="font-metric-tabular text-label-micro text-outline font-semibold">{sovPct}% ratio</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between transition-all hover:shadow-md group">
            <div className="flex items-center justify-between">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">Motores Activos</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">psychology</span>
              </div>
            </div>
            <div className="my-space-sm flex items-baseline gap-space-sm">
              <span className="font-headline-metric text-headline-metric font-bold text-on-surface">4</span>
              <span className="font-body-default text-body-sm text-outline">con telemetría</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ChatGPT', 'Gemini', 'Perplexity', 'Claude'].map((m) => (
                <span
                  key={m}
                  className="font-label-micro text-label-micro px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface font-medium"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between transition-all hover:shadow-md group">
            <div className="flex items-center justify-between">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">
                Variación Semanal
              </span>
              <div className="w-8 h-8 rounded-lg bg-secondary-fixed/40 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[18px]">query_stats</span>
              </div>
            </div>
            <div className="my-space-sm flex items-baseline gap-space-sm">
              <span className="font-headline-metric text-headline-metric font-bold text-secondary">+1 pp</span>
              <span className="font-body-default text-body-sm text-on-secondary-container bg-secondary-container/40 px-2 py-0.5 rounded">
                Ganando terreno
              </span>
            </div>
            <div className="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
              <span>4 → 5 menciones</span>
              <span className="font-label-micro text-label-micro text-secondary font-semibold">+25% net</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between transition-all hover:shadow-md group">
            <div className="flex items-center justify-between">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">
                Rival Principal #1
              </span>
              <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[18px]">military_tech</span>
              </div>
            </div>
            <div className="my-space-sm flex items-baseline gap-space-sm">
              <span className="font-headline-metric text-headline-metric font-bold text-on-surface">Beetrack</span>
              <span className="font-label-micro text-label-micro text-tertiary bg-tertiary-fixed/60 px-2 py-0.5 rounded font-semibold">
                28% SOV
              </span>
            </div>
            <div className="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
              <span>14 / 50 prompts</span>
              <span className="font-label-micro text-label-micro text-outline font-semibold">Gap −18 pp</span>
            </div>
          </div>
        </div>

        {/* Prompts table — Stitch */}
        <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md mb-space-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-headline-title text-headline-title text-on-surface">
                Muestra de Prompts y Diagnóstico en Motores
              </h2>
              <span className="font-label-micro text-label-micro text-outline">
                8 prompts estratégicos de 50 monitoreados
              </span>
            </div>
            <div className="flex items-center gap-space-xs flex-wrap">
              {(
                [
                  ['todos', `Todos (${SOV_ROWS.length})`],
                  ['aparece', `Aparece (${wins})`],
                  ['gaps', `Gaps / No (${gaps})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={
                    filter === key
                      ? 'px-space-sm py-1 rounded bg-primary-fixed text-on-primary-fixed font-label-micro text-label-micro font-semibold'
                      : 'px-space-sm py-1 rounded hover:bg-surface-container text-on-surface-variant font-label-micro text-label-micro'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase">
                  <th className="py-space-sm px-space-lg">Prompt Analizado</th>
                  <th className="py-space-sm px-space-md">Empliados</th>
                  <th className="py-space-sm px-space-md">Líder Actual</th>
                  <th className="py-space-sm px-space-md">Mejor Motor</th>
                  <th className="py-space-sm px-space-lg text-right">Acción Sugerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-default text-body-sm">
                {filtered.map((row) => (
                  <tr key={row.prompt} className="hover:bg-surface-container-low/60 transition-colors group">
                    <td className="py-space-md px-space-lg min-w-[240px]">
                      <div className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-[16px] text-primary">chat_bubble_outline</span>
                        <span className="font-body-medium text-body-sm font-semibold text-on-surface">{row.prompt}</span>
                      </div>
                    </td>
                    <td className="py-space-md px-space-md">
                      {row.empliados ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container font-label-micro text-label-micro font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          Aparece
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-outline font-label-micro text-label-micro font-semibold">
                          No
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-space-md px-space-md font-body-medium text-body-sm ${
                        row.empliados ? 'text-secondary font-semibold' : 'text-on-surface'
                      }`}
                    >
                      {row.empliados ? `${row.rival} (Líder)` : row.rival}
                    </td>
                    <td className="py-space-md px-space-md">
                      <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-micro text-label-micro">
                        {row.motor}
                      </span>
                    </td>
                    <td className="py-space-md px-space-lg text-right">
                      <button
                        type="button"
                        className="px-space-sm py-1 rounded text-primary hover:bg-primary-fixed/50 font-label-micro text-label-micro font-medium transition-colors"
                      >
                        {row.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribution + competitive — Stitch */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg mb-space-lg">
          <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline-title text-body-medium font-bold text-on-surface">
                  Distribución por Motor IA
                </h3>
                <span className="font-label-micro text-label-micro text-outline">
                  Tasa de citación ponderada en respuestas
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">hub</span>
              </div>
            </div>
            <div className="flex flex-col gap-space-md mt-space-xs">
              {ENGINES.map((e) => (
                <div key={e.name}>
                  <div className="flex items-center justify-between text-body-sm mb-1">
                    <span className="font-body-medium font-semibold text-on-surface flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${e.dot}`} />
                      {e.name}
                    </span>
                    <span className="font-metric-tabular font-bold text-on-surface">{e.pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full ${e.bar} rounded-full`} style={{ width: `${e.pct}%` }} />
                  </div>
                  <span className="font-label-micro text-[10px] text-outline mt-0.5 block">{e.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-headline-title text-body-medium font-bold text-on-surface">
                  Cuota de Voz Competitiva en Respuestas IA
                </h3>
                <span className="font-label-micro text-label-micro text-outline">
                  Benchmark sobre 50 prompts evaluados
                </span>
              </div>
              <div className="flex items-center gap-space-sm">
                <span className="font-label-micro text-label-micro text-outline">Actualizado hoy</span>
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {COMPETITORS.map((c) => (
                <div
                  key={c.name}
                  className={
                    c.you
                      ? 'p-space-md rounded-xl bg-primary-fixed/40 flex flex-col justify-between'
                      : 'p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between'
                  }
                >
                  <div className="flex items-center justify-between mb-space-sm">
                    <span
                      className={`font-body-medium text-body-sm font-bold flex items-center gap-1 ${
                        c.you ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      {c.rank}. {c.name}
                      {c.you ? <span className="material-symbols-outlined text-[16px]">verified</span> : null}
                    </span>
                    <span
                      className={
                        c.you
                          ? 'px-2 py-0.5 rounded bg-primary text-on-primary font-label-micro text-label-micro font-bold'
                          : c.tone === 'tertiary'
                            ? 'px-2 py-0.5 rounded bg-tertiary-fixed text-tertiary font-label-micro text-label-micro font-bold'
                            : 'px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-micro text-label-micro font-bold'
                      }
                    >
                      {c.sov}% SOV
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 mb-space-xs">
                    <div
                      className={`h-1.5 rounded-full ${c.you ? 'bg-primary' : c.tone === 'tertiary' ? 'bg-tertiary' : 'bg-outline'}`}
                      style={{ width: `${c.sov}%` }}
                    />
                  </div>
                  <span
                    className={`font-body-sm text-[12px] ${c.you ? 'text-primary font-medium' : 'text-outline'}`}
                  >
                    {c.mentions} menciones • {c.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
