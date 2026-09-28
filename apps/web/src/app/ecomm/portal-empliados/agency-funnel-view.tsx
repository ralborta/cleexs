'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  Share2,
  Target,
  TrendingDown,
  Users,
} from 'lucide-react';
import {
  buildAcquisitionStages,
  type FunnelMetrics,
} from '@/components/funnel/funnel-dashboard';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function pctLabel(p: number | null) {
  return p == null ? '—' : `${String(p).replace('.', ',')}%`;
}

function pctOf(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
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

/**
 * Funnel Agency fiel al HTML Stitch, cableado a /api/borrador/portal-funnel.
 */
export function AgencyFunnelView() {
  const today = useMemo(() => todayAR(), []);
  const initial = useMemo(() => ({ from: addDays(today, -29), to: today }), [today]);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<string | null>('30');
  const [adSpendInput, setAdSpendInput] = useState('');
  const [data, setData] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const spend = Number(adSpendInput.replace(',', '.'));
      if (Number.isFinite(spend) && spend >= 0 && adSpendInput.trim() !== '') {
        params.set('adSpendUsd', String(spend));
      }
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
  }, [from, to, adSpendInput]);

  useEffect(() => {
    void load();
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (abandoned > worst.abandoned) {
      worst = { from: prev.label, to: cur.label, abandoned, dropPct };
    }
  }

  const eco = data?.economics;
  const referrers = (data?.byReferrer ?? []).slice(0, 6);

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Header Stitch */}
      <div className="flex flex-col justify-between gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0] md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e1e0ff] text-[#4648d4] shadow-sm">
            <Filter className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-[#0f172a]">
                Embudo de Adquisición & Cohortes
              </h1>
              <span className="rounded-full bg-[#6ffbbe]/40 px-2 py-0.5 text-[12px] font-semibold text-[#005236]">
                En tiempo real
              </span>
            </div>
            <p className="text-[13px] text-[#64748b]">
              Análisis de pérdida por etapa del funnel de diagnóstico y retención.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-4 py-2 text-sm font-medium text-[#0f172a] shadow-sm hover:bg-[#e2e8f0] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0] lg:flex-row lg:items-center">
        <div className="inline-flex flex-wrap rounded-lg bg-[#f1f5f9] p-1">
          {(
            [
              ['hoy', 'Hoy'],
              ['ayer', 'Ayer'],
              ['7', 'Últimos 7 días'],
              ['15', 'Últimos 15 días'],
              ['30', 'Últimos 30 días'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                preset === key
                  ? 'bg-[#4648d4] font-semibold text-white shadow-sm'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <div className="flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Desde</span>
            <Calendar className="h-4 w-4 text-[#94a3b8]" />
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset(null);
              }}
              className="bg-transparent text-sm font-semibold text-[#0f172a] outline-none"
            />
          </div>
          <span className="text-[#94a3b8]">→</span>
          <div className="flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Hasta</span>
            <Calendar className="h-4 w-4 text-[#94a3b8]" />
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset(null);
              }}
              className="bg-transparent text-sm font-semibold text-[#0f172a] outline-none"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {/* KPI cards Stitch */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Visitantes únicos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e1e0ff] text-[#4648d4]">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-[26px] font-bold tabular-nums tracking-tight text-[#0f172a]">{fmt(base)}</span>
            <span className="text-[13px] text-[#94a3b8]">usuarios</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e2e7ff]">
            <div className="h-full w-full rounded-full bg-[#4648d4]" />
          </div>
          <p className="mt-2 text-[12px] text-[#64748b]">
            Cohorte {formatDay(from)} — {formatDay(to)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Conversión final
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9ddff] text-[#6b38d4]">
              <Share2 className="h-5 w-5" />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-[26px] font-bold tabular-nums tracking-tight text-[#0f172a]">
              {pctLabel(finalConv)}
            </span>
            <span className="text-[13px] text-[#94a3b8]">({fmt(last?.count ?? 0)} conversiones)</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e2e7ff]">
            <div
              className="h-full rounded-full bg-[#8455ef]"
              style={{ width: `${Math.min(100, finalConv ?? 0)}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-[#64748b]">Visitantes → Compartieron</p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Mayor punto de abandono
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ffdad6] text-[#ba1a1a]">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-[26px] font-bold tabular-nums tracking-tight text-[#ba1a1a]">
              {fmt(worst.abandoned)}
            </span>
            <span className="text-[13px] text-[#94a3b8]">abandonaron</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e2e7ff]">
            <div
              className="h-full rounded-full bg-[#ba1a1a]"
              style={{ width: `${Math.min(100, worst.dropPct)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
            <span className="rounded bg-[#ffdad6]/60 px-1.5 py-0.5 font-semibold text-[#ba1a1a]">
              {pctLabel(worst.dropPct)} tasa de fuga
            </span>
            <span className="text-[#64748b]">
              {worst.from ? `${worst.from.split(' ')[0]} → ${worst.to.split(' ')[0]}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Progression + opportunity */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0] lg:col-span-8 lg:p-6">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-[#0f172a]">Progresión por Etapas</h2>
              <p className="text-[13px] text-[#64748b]">
                Flujo visual completo desde la visita inicial hasta la acción de compartir.
              </p>
            </div>
            <span className="self-start rounded bg-[#e2e7ff] px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#464554]">
              {stages.length} etapas activas
            </span>
          </div>

          {loading && !data ? (
            <div className="flex items-center gap-2 py-10 text-sm text-[#64748b]">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando embudo…
            </div>
          ) : (
            <div className="flex flex-col">
              {stages.map((stage, index) => {
                const ofTotal = pctOf(stage.count, base || 1);
                const widthPct =
                  base > 0
                    ? Math.min(100, Math.max((stage.count / base) * 100, stage.count > 0 ? 6 : 0))
                    : 0;
                const prev = index > 0 ? stages[index - 1] : null;
                const advanced = prev ? pctOf(stage.count, prev.count) : null;
                const abandoned = prev ? Math.max(0, prev.count - stage.count) : 0;
                const isWorst =
                  prev &&
                  worst.abandoned > 0 &&
                  prev.label === worst.from &&
                  stage.label === worst.to;
                const icons = [
                  <Users key="u" className="h-4 w-4" />,
                  <ClipboardList key="c" className="h-4 w-4" />,
                  <CheckCircle2 key="k" className="h-4 w-4" />,
                  <Mail key="m" className="h-4 w-4" />,
                  <Share2 key="s" className="h-4 w-4" />,
                ];

                return (
                  <div key={stage.key}>
                    {index > 0 && prev ? (
                      <div className="mb-3 ml-10 flex items-center gap-2 py-1 text-[11px] sm:ml-12">
                        <ArrowDown className={`h-3.5 w-3.5 ${isWorst ? 'text-rose-500' : 'text-slate-300'}`} />
                        <span className="font-medium text-[#64748b]">{pctLabel(advanced)} avanzó</span>
                        <span className="text-slate-300">·</span>
                        <span className={isWorst ? 'font-semibold text-rose-600' : 'text-[#64748b]'}>
                          {fmt(abandoned)} abandonaron
                        </span>
                      </div>
                    ) : null}
                    <div className="flex gap-3 sm:gap-4">
                      <div className="flex w-8 shrink-0 flex-col items-center sm:w-9">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[11px] font-bold text-[#4648d4] shadow-sm sm:h-9 sm:w-9">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pb-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[#94a3b8]">{icons[index] ?? stage.icon}</span>
                          <p className="text-sm font-semibold text-[#0f172a]">{stage.label}</p>
                        </div>
                        <p className="mb-2 text-xs text-[#64748b]">
                          {fmt(stage.count)} usuarios
                          {ofTotal != null ? <> · {String(ofTotal).replace('.', ',')}% del total</> : null}
                        </p>
                        <div className="h-3 overflow-hidden rounded-full bg-[#f1f5f9]">
                          <div
                            className="h-full rounded-full bg-[#4648d4] transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-amber-100 bg-gradient-to-b from-orange-50 to-amber-50/70 p-5 shadow-sm lg:col-span-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <Target className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-[#0f172a]">Principal oportunidad</h3>
          {worst.abandoned > 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-[#334155]">
              El <strong>{pctLabel(worst.dropPct)}</strong> abandona entre{' '}
              <strong>{worst.from}</strong> y <strong>{worst.to}</strong>.
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#64748b]">Sin abandonos relevantes en el rango.</p>
          )}
          <p className="mt-3 text-[13px] text-[#64748b]">
            {fmt(worst.abandoned)} personas se perdieron en ese paso
          </p>
          {f?.shares.byChannel?.length ? (
            <p className="mt-4 rounded-lg bg-white/70 px-3 py-2 text-[12px] text-[#475569]">
              Canales de share:{' '}
              {f.shares.byChannel
                .slice(0, 4)
                .map((c) => `${c.channel} ${c.count}`)
                .join(' · ')}
            </p>
          ) : null}
        </aside>
      </div>

      {/* Economics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Inversión publicitaria',
            value: `US$ ${fmt(eco?.adSpendUsd ?? 0)}`,
            hint: 'Meta Ads · rango actual',
          },
          {
            label: 'CAC',
            value: `US$ ${fmt(eco?.cacUsd ?? 0)}`,
            hint:
              eco && eco.payingCustomers > 0 && eco.adSpendUsd > 0
                ? `÷ ${fmt(eco.payingCustomers)} compradores`
                : 'Cargá inversión para calcular',
          },
          {
            label: 'LTV',
            value: `US$ ${fmt(eco?.ltvUsd ?? 0)}`,
            hint: eco && eco.payingCustomers > 0 ? 'Promedio ingreso PC' : 'Sin compras en el cohort',
          },
          {
            label: 'Payback',
            value: `${fmt(eco?.paybackDays ?? 0)} días`,
            hint: 'Días para recuperar el CAC',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">{card.label}</p>
            <p className="mt-2 text-[22px] font-bold tabular-nums text-[#0f172a]">{card.value}</p>
            <p className="mt-1 text-[12px] text-[#64748b]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0]">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          Ad spend USD
          <input
            type="number"
            min={0}
            step="0.01"
            value={adSpendInput}
            placeholder="USD"
            onChange={(e) => setAdSpendInput(e.target.value)}
            className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#c7d2fe] focus:ring-2 focus:ring-[#eef2ff]"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg bg-[#4648d4] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4f46e5] disabled:opacity-50"
        >
          Recalcular CAC
        </button>
      </div>

      {/* Referrers mini */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0]">
        <h2 className="text-[20px] font-semibold tracking-tight text-[#0f172a]">Referidores y campañas</h2>
        <p className="mb-4 text-[13px] text-[#64748b]">Top refs del rango (misma fuente que Funnel admin).</p>
        {referrers.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#94a3b8]">Sin referidores en el rango.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9] text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  <th className="pb-2 pr-3">Nombre</th>
                  <th className="pb-2 pr-3">Diagnósticos</th>
                  <th className="pb-2 pr-3">Con email</th>
                  <th className="pb-2">Completados</th>
                </tr>
              </thead>
              <tbody>
                {referrers.map((r) => (
                  <tr key={r.refCode} className="border-b border-[#f8fafc]">
                    <td className="py-2.5 pr-3 font-medium text-[#0f172a]">
                      {r.name}
                      <span className="mt-0.5 block font-mono text-[11px] text-[#94a3b8]">{r.refCode}</span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{fmt(r.diagnostics)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{fmt(r.withEmail)}</td>
                    <td className="py-2.5 tabular-nums">{fmt(r.completed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
