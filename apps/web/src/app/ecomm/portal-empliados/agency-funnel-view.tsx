'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FunnelMetrics } from '@/components/funnel/funnel-dashboard';
import { buildAcquisitionStages } from '@/components/funnel/funnel-dashboard';
import './agency-stitch-scope.css';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function pctOf(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function pctLabel(p: number | null) {
  return p == null ? '—' : `${String(p).replace('.', ',')}%`;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function todayAR(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDay(s: string) {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const STAGE_META: Array<{
  icon: string;
  bar: string;
  noteDrop: string;
  good?: boolean;
  final?: boolean;
}> = [
  { icon: 'visibility', bar: 'bg-primary', noteDrop: 'Pérdida en landing page' },
  { icon: 'play_circle', bar: 'bg-primary-container', noteDrop: 'Pérdida en preguntas intermedias' },
  { icon: 'task_alt', bar: 'bg-tertiary-container', noteDrop: 'Excelente retención inmediata', good: true },
  { icon: 'mark_email_read', bar: 'bg-tertiary', noteDrop: 'Poco incentivo para viralizar' },
  { icon: 'share', bar: 'bg-secondary', noteDrop: '', final: true },
];

const CHANNEL_ICON: Record<string, string> = {
  copy: 'link',
  whatsapp: 'chat',
  email: 'mail',
  linkedin: 'share',
  other: 'share',
};

/**
 * Funnel = HTML Stitch (funnel-de-adquisici-n.html) + datos vivos portal-funnel.
 */
export function AgencyFunnelView() {
  const today = useMemo(() => todayAR(), []);
  const [from, setFrom] = useState(() => addDays(today, -29));
  const [to, setTo] = useState(today);
  const [preset, setPreset] = useState<string | null>('30');
  const [data, setData] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/borrador/portal-funnel?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar el funnel');
      setData(json as FunnelMetrics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(key: 'hoy' | 'ayer' | '7' | '15' | '30') {
    setPreset(key);
    if (key === 'hoy') {
      setFrom(today);
      setTo(today);
      return;
    }
    if (key === 'ayer') {
      const y = addDays(today, -1);
      setFrom(y);
      setTo(y);
      return;
    }
    const span = key === '7' ? 6 : key === '15' ? 14 : 29;
    setFrom(addDays(today, -span));
    setTo(today);
  }

  const f = data?.funnel;
  const stages = f ? buildAcquisitionStages(f) : [];
  const base = stages[0]?.count ?? 0;
  const last = stages[stages.length - 1];
  const finalConv = pctOf(last?.count ?? 0, base || 1);

  let worst = { from: '', to: '', abandoned: 0, dropPct: 0 };
  for (let i = 1; i < stages.length; i += 1) {
    const prev = stages[i - 1]!;
    const cur = stages[i]!;
    const abandoned = Math.max(0, prev.count - cur.count);
    const dropPct = prev.count > 0 ? Math.round((abandoned / prev.count) * 1000) / 10 : 0;
    if (abandoned > worst.abandoned) worst = { from: prev.label, to: cur.label, abandoned, dropPct };
  }

  const shares = f?.shares.byChannel ?? [];
  const shareTotal = shares.reduce((s, c) => s + c.count, 0) || 1;

  const chip = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => applyPreset(key as 'hoy' | 'ayer' | '7' | '15' | '30')}
      className={
        preset === key
          ? 'filter-chip px-space-md py-1.5 rounded-md font-body-medium text-body-sm bg-primary text-on-primary shadow-sm font-semibold transition-all'
          : 'filter-chip px-space-md py-1.5 rounded-md font-body-medium text-body-sm text-on-surface-variant hover:text-on-surface transition-all'
      }
    >
      {label}
    </button>
  );

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg">
      {/* Header Section — Stitch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex items-center gap-space-md">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shadow-sm">
            <span className="material-symbols-outlined text-[26px]">filter_alt</span>
          </div>
          <div>
            <div className="flex items-center gap-space-xs flex-wrap">
              <h1 className="font-headline-title text-headline-title text-on-surface">
                Embudo de Adquisición &amp; Cohortes
              </h1>
              <span className="bg-secondary-container/40 text-on-secondary-container font-badge-label text-badge-label px-space-xs py-0.5 rounded-full">
                En tiempo real
              </span>
            </div>
            <p className="font-body-default text-body-sm text-on-surface-variant">
              Análisis de pérdida por etapa del funnel de diagnóstico y retención.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors font-body-medium text-body-sm shadow-sm disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>sync</span>
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-body-medium text-body-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Filter bar — Stitch */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center bg-surface-container-low p-1 rounded-lg gap-1">
          {chip('hoy', 'Hoy')}
          {chip('ayer', 'Ayer')}
          {chip('7', 'Últimos 7 días')}
          {chip('15', 'Últimos 15 días')}
          {chip('30', 'Últimos 30 días')}
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          <div className="flex items-center bg-surface-container-low px-space-md py-1.5 rounded-lg gap-space-sm">
            <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">Desde</span>
            <div className="flex items-center gap-1 font-metric-tabular text-body-sm text-on-surface font-semibold">
              <span className="material-symbols-outlined text-[16px] text-outline">calendar_today</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset(null);
                }}
                className="bg-transparent border-none outline-none w-24 text-on-surface font-metric-tabular text-body-sm"
                aria-label={formatDay(from)}
              />
            </div>
          </div>
          <span className="text-outline font-label-micro">→</span>
          <div className="flex items-center bg-surface-container-low px-space-md py-1.5 rounded-lg gap-space-sm">
            <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">Hasta</span>
            <div className="flex items-center gap-1 font-metric-tabular text-body-sm text-on-surface font-semibold">
              <span className="material-symbols-outlined text-[16px] text-outline">event</span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset(null);
                }}
                className="bg-transparent border-none outline-none w-24 text-on-surface font-metric-tabular text-body-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl bg-error-container/40 px-space-md py-space-sm text-error font-body-sm">{error}</div>
      ) : null}

      {/* KPI cards — Stitch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="font-label-micro text-label-micro uppercase tracking-wider text-outline">
              Visitantes Únicos
            </span>
            <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">group</span>
            </div>
          </div>
          <div className="my-space-md">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-metric text-headline-metric text-on-surface">{fmt(base)}</span>
              <span className="font-body-default text-body-sm text-outline">usuarios</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-space-sm overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant pt-space-xs">
            <span className="flex items-center gap-0.5 text-secondary font-badge-label text-badge-label bg-secondary-container/30 px-1.5 py-0.5 rounded">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              en vivo
            </span>
            <span className="font-body-default text-[12px] text-outline">
              {formatDay(from)} — {formatDay(to)}
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="font-label-micro text-label-micro uppercase tracking-wider text-outline">
              Conversión Final
            </span>
            <div className="w-9 h-9 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[20px]">filter_alt</span>
            </div>
          </div>
          <div className="my-space-md">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-metric text-headline-metric text-on-surface">{pctLabel(finalConv)}</span>
              <span className="font-body-default text-body-sm text-outline">
                ({fmt(last?.count ?? 0)} conversiones)
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-space-sm overflow-hidden">
              <div
                className="bg-tertiary h-full rounded-full"
                style={{ width: `${Math.min(100, finalConv ?? 0)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant pt-space-xs">
            <span className="flex items-center gap-0.5 text-secondary font-badge-label text-badge-label bg-secondary-container/30 px-1.5 py-0.5 rounded">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              Visitantes → Share
            </span>
            <span className="font-body-default text-[12px] text-outline">Visitantes → Compartieron</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="font-label-micro text-label-micro uppercase tracking-wider text-outline">
              Mayor Punto de Abandono
            </span>
            <div className="w-9 h-9 rounded-lg bg-error-container flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[20px]">trending_down</span>
            </div>
          </div>
          <div className="my-space-md">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-metric text-headline-metric text-error">{fmt(worst.abandoned)}</span>
              <span className="font-body-default text-body-sm text-outline">abandonaron</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-space-sm overflow-hidden">
              <div className="bg-error h-full rounded-full" style={{ width: `${Math.min(100, worst.dropPct)}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant pt-space-xs">
            <span className="flex items-center gap-0.5 text-error font-badge-label text-badge-label bg-error-container/40 px-1.5 py-0.5 rounded">
              <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
              {pctLabel(worst.dropPct)} tasa de fuga
            </span>
            <span className="font-body-default text-[12px] text-outline">
              {worst.from ? `${worst.from.split(' ')[0]} → ${worst.to.split(' ')[0]}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline + insights — Stitch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-lg md:p-space-xl rounded-xl shadow-sm flex flex-col gap-space-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm gap-space-xs">
            <div>
              <h2 className="font-headline-title text-headline-title text-on-surface">Progresión por Etapas</h2>
              <p className="font-body-default text-body-sm text-outline">
                Flujo visual completo desde la visita inicial hasta la acción de compartir.
              </p>
            </div>
            <span className="bg-surface-container-high text-on-surface-variant px-space-sm py-1 rounded font-label-micro text-label-micro self-start sm:self-auto">
              {stages.length || 5} etapas activas
            </span>
          </div>

          <div className="flex flex-col">
            {stages.map((stage, index) => {
              const meta = STAGE_META[index] ?? STAGE_META[0]!;
              const ofTotal = pctOf(stage.count, base || 1);
              const widthPct =
                base > 0 ? Math.min(100, Math.max((stage.count / base) * 100, stage.count > 0 ? 4 : 0)) : 0;
              const prev = index > 0 ? stages[index - 1] : null;
              const advanced = prev ? pctOf(stage.count, prev.count) : null;
              const abandoned = prev ? Math.max(0, prev.count - stage.count) : 0;
              const goodDrop = Boolean(meta.good) || (advanced != null && advanced >= 95);

              return (
                <div key={stage.key}>
                  {index > 0 && prev ? (
                    <div className="flex items-center gap-space-md py-space-sm">
                      <div className="w-9 flex justify-center shrink-0">
                        <div className={`w-0.5 h-10 ${goodDrop ? 'bg-secondary/50' : 'bg-outline-variant/60'}`} />
                      </div>
                      <div
                        className={`flex items-center gap-space-md px-space-md py-1.5 rounded-lg flex-1 ${
                          goodDrop ? 'bg-secondary-container/20' : 'bg-surface-container-low'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1 font-badge-label text-badge-label ${
                            goodDrop ? 'text-secondary font-bold' : 'text-secondary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {goodDrop ? 'check_circle' : 'south'}
                          </span>
                          <span>{pctLabel(advanced)} avanzó</span>
                        </div>
                        <span className="text-outline-variant">•</span>
                        <div
                          className={`flex items-center gap-1 font-badge-label text-badge-label ${
                            abandoned > 0 ? 'text-error' : 'text-on-surface-variant'
                          }`}
                        >
                          {abandoned > 0 ? (
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          ) : null}
                          <span className={abandoned > 0 ? 'font-semibold' : undefined}>
                            {fmt(abandoned)} abandonaron
                          </span>
                        </div>
                        {meta.noteDrop ? (
                          <span
                            className={`hidden sm:inline font-body-sm text-[12px] ml-auto ${
                              goodDrop ? 'text-secondary font-medium' : 'text-outline'
                            }`}
                          >
                            {meta.noteDrop}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-space-md group">
                    <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface font-metric-tabular text-body-medium font-bold flex items-center justify-center shrink-0 shadow-sm mt-0.5 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      {index + 1}
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-space-xs">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              meta.final ? 'text-secondary' : index >= 2 ? 'text-secondary' : 'text-primary'
                            }`}
                          >
                            {meta.icon}
                          </span>
                          <span className="font-headline-title text-body-medium font-bold text-on-surface">
                            {stage.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-space-sm">
                          <span
                            className={`font-metric-tabular text-body-sm font-semibold ${
                              meta.final ? 'text-secondary' : 'text-on-surface'
                            }`}
                          >
                            {fmt(stage.count)} usuarios
                          </span>
                          <span
                            className={`font-label-micro text-label-micro px-1.5 py-0.5 rounded ${
                              meta.final
                                ? 'text-secondary bg-secondary-container/40 font-bold'
                                : 'text-outline bg-surface-container-low'
                            }`}
                          >
                            {index === 0 ? '100%' : `${pctLabel(ofTotal)} del total`}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden">
                        <div
                          className={`${meta.bar} h-full rounded-full transition-all duration-700`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel — Stitch */}
        <div className="lg:col-span-4 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md relative overflow-hidden">
            <div className="flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-lg bg-error-container text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">crisis_alert</span>
              </div>
              <div>
                <span className="font-label-micro text-label-micro uppercase tracking-wider text-outline">
                  Diagnóstico Crítico
                </span>
                <h3 className="font-headline-title text-body-medium font-bold text-on-surface">
                  Principal oportunidad
                </h3>
              </div>
            </div>
            <div className="p-space-md bg-error-container/30 rounded-lg flex flex-col gap-1">
              <span className="font-headline-title text-body-medium font-bold text-error">
                El {pctLabel(worst.dropPct)} abandona el proceso
              </span>
              <p className="font-body-default text-body-sm text-on-surface">
                Se pierden entre los <strong className="font-semibold text-on-surface">{worst.from || '—'}</strong> y
                el <strong className="font-semibold text-on-surface">{worst.to || '—'}</strong>. Representa una fuga
                de {fmt(worst.abandoned)} personas que entraron pero no realizaron la primera acción.
              </p>
            </div>
            <div className="flex flex-col gap-space-sm pt-space-xs">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">
                Plan de Acción Recomendado
              </span>
              {[
                {
                  icon: 'touch_app',
                  title: 'Simplificar CTA Principal',
                  body: 'Reemplazar “Empezar test completo” por un botón más directo con estimación “Comenzar (2 min)”.',
                },
                {
                  icon: 'view_stream',
                  title: 'Muestra de Valor Previa',
                  body: 'Mostrar 1 pregunta directa o tarjeta interactiva en el Hero para enganchar sin abrir modal.',
                },
                {
                  icon: 'verified_user',
                  title: 'Social Proof Above-the-fold',
                  body: 'Añadir badges de clientes verificados inmediatamente debajo del selector de industria.',
                },
              ].map((row) => (
                <div key={row.title} className="flex items-start gap-space-xs bg-surface-container-low p-space-sm rounded-lg">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">{row.icon}</span>
                  <div className="flex flex-col">
                    <span className="font-body-medium text-body-sm font-semibold text-on-surface">{row.title}</span>
                    <span className="font-body-default text-[12px] text-on-surface-variant">{row.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="w-full py-space-sm px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-medium text-body-sm transition-colors flex items-center justify-center gap-space-xs mt-space-xs"
            >
              <span>Crear Experimento A/B</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-micro text-label-micro uppercase tracking-wider text-outline">
                Rendimiento por Canal
              </span>
              <span className="material-symbols-outlined text-[18px] text-outline">pie_chart</span>
            </div>
            <div className="space-y-space-xs">
              {(data?.byReferrer ?? [])
                .slice(0, 3)
                .map((r, i) => {
                  const conv =
                    r.diagnostics > 0 ? Math.round((r.withEmail / r.diagnostics) * 1000) / 10 : 0;
                  const dot = i === 0 ? 'bg-primary' : i === 1 ? 'bg-tertiary' : 'bg-secondary';
                  return (
                    <div key={r.refCode} className="flex items-center justify-between text-body-sm font-body-default">
                      <span className="text-on-surface flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        {r.name}
                      </span>
                      <span className="font-metric-tabular font-semibold text-on-surface">{conv}% conv.</span>
                    </div>
                  );
                })}
              {(data?.byReferrer ?? []).length === 0 ? (
                <p className="font-body-sm text-outline">Sin desglose de canal en el rango.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Share channels — Stitch */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-lg">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">share_reviews</span>
          </div>
          <div>
            <h4 className="font-headline-title text-body-medium font-bold text-on-surface">
              Distribución de Canales de Share
            </h4>
            <p className="font-body-default text-body-sm text-outline">
              Desglose de los {fmt(f?.shares.count ?? 0)} usuarios que compartieron el reporte generado.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-md">
          {(shares.length ? shares : [{ channel: 'copy', count: 0 }]).slice(0, 4).map((c) => {
            const pct = Math.round((c.count / shareTotal) * 1000) / 10;
            const label =
              c.channel === 'copy'
                ? 'Copiar Link'
                : c.channel === 'whatsapp'
                  ? 'WhatsApp'
                  : c.channel === 'email'
                    ? 'Email'
                    : c.channel;
            const icon = CHANNEL_ICON[c.channel] || 'share';
            return (
              <div
                key={c.channel}
                className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-xs rounded-lg"
              >
                <div className="w-7 h-7 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">{icon}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-medium text-[12px] text-outline">{label}</span>
                  <span className="font-metric-tabular text-body-medium font-bold text-on-surface">
                    {fmt(c.count)}{' '}
                    <span className="text-outline font-normal text-body-sm">({pct}%)</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
