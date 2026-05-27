'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, BarChart3, Building2, Trophy } from 'lucide-react';
import { internalReportsApi, type CleexsScoreReport, type ReportWindowDays } from '@/lib/api';
import {
  MiniBars,
  ReportErrorBanner,
  ReportLoading,
  ReportMetric,
  ReportRefreshButton,
  ReportSection,
  WindowDaysToggle,
  formatDate,
  formatDateShort,
} from '@/components/admin/report-ui';

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
  if (score >= 60) return 'bg-sky-100 text-sky-800 ring-1 ring-sky-200';
  if (score >= 40) return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  if (score >= 20) return 'bg-orange-100 text-orange-800 ring-1 ring-orange-200';
  return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200';
}

const BUCKETS = [
  { key: 'poor', label: '0-19', tone: 'bg-rose-500' },
  { key: 'low', label: '20-39', tone: 'bg-orange-400' },
  { key: 'mid', label: '40-59', tone: 'bg-amber-400' },
  { key: 'good', label: '60-79', tone: 'bg-sky-500' },
  { key: 'excellent', label: '80-100', tone: 'bg-emerald-500' },
] as const;

export default function CleexsScoreReportPage() {
  const [data, setData] = useState<CleexsScoreReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<ReportWindowDays>(30);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await internalReportsApi.cleexsScore(windowDays);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte de Cleexs Score.');
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const maxBucket = data
    ? Math.max(1, ...BUCKETS.map((b) => data.distribution[b.key as keyof typeof data.distribution]))
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cleexs Score y posicionamiento</h2>
          <p className="text-xs text-slate-500">
            Como performean las marcas analizadas en los ultimos {windowDays} dias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WindowDaysToggle value={windowDays} onChange={setWindowDays} disabled={loading} />
          <ReportRefreshButton loading={loading} onClick={load} />
        </div>
      </div>

      {error ? <ReportErrorBanner message={error} /> : null}
      {loading && !data ? <ReportLoading /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <ReportMetric
              label="Marcas analizadas"
              value={data.totals.brandsAnalyzed}
              Icon={Building2}
              tone="sky"
            />
            <ReportMetric
              label="Cleexs Score promedio"
              value={data.totals.averageScore.toFixed(1)}
              Icon={Award}
              tone="violet"
              hint="sobre 100"
            />
            <ReportMetric
              label="Reportes generados"
              value={data.totals.reportsInWindow}
              Icon={BarChart3}
              tone="emerald"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReportSection
              title="Distribucion del Cleexs Score"
              description="Cuantas marcas caen en cada rango de score."
            >
              {data.totals.reportsInWindow === 0 ? (
                <p className="text-sm text-slate-500">Sin reportes en la ventana.</p>
              ) : (
                <div className="flex items-end gap-3" style={{ height: 140 }}>
                  {BUCKETS.map((b) => {
                    const value = data.distribution[b.key as keyof typeof data.distribution];
                    const h = (value / maxBucket) * 120;
                    return (
                      <div key={b.key} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className={`w-full rounded-t-md ${b.tone}`}
                            style={{ height: Math.max(h, value > 0 ? 4 : 0) }}
                            title={`${b.label}: ${value} marcas`}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold tabular-nums text-slate-900">{value}</p>
                          <p className="text-[10px] text-slate-500">{b.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ReportSection>

            <ReportSection
              title="Evolucion diaria"
              description="Reportes generados por dia (barras) y score promedio."
            >
              <MiniBars
                data={data.dailySeries.map((row) => ({ label: row.date, value: row.runs }))}
                height={120}
              />
              <div className="mt-3 flex justify-between text-[10px] text-slate-400">
                <span>{formatDateShort(data.dailySeries[0]?.date)}</span>
                <span>{formatDateShort(data.dailySeries[data.dailySeries.length - 1]?.date)}</span>
              </div>
            </ReportSection>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReportSection
              title="Top 10 marcas (mejor score)"
              description="Las marcas mejor posicionadas en los ultimos reportes."
              action={<Trophy className="h-4 w-4 text-amber-500" />}
            >
              {data.topBrands.length === 0 ? (
                <p className="text-sm text-slate-500">Sin marcas en la ventana.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2">Marca</th>
                      <th className="py-2 text-right">Score</th>
                      <th className="py-2 text-right">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topBrands.map((row) => (
                      <tr key={row.brandId} className="border-t border-slate-100">
                        <td className="py-2">
                          <div className="font-medium text-slate-900">{row.brandName}</div>
                          <div className="text-xs text-slate-500">
                            {row.domain || '—'}
                            {row.industry ? ` · ${row.industry}` : ''}
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadge(row.latestScore)}`}>
                            {row.latestScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-600">{row.runs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportSection>

            <ReportSection
              title="Bottom 10 marcas (oportunidad Premium)"
              description="Marcas con peor score: candidatas a upgrade a Premium."
            >
              {data.bottomBrands.length === 0 ? (
                <p className="text-sm text-slate-500">Sin marcas en la ventana.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2">Marca</th>
                      <th className="py-2 text-right">Score</th>
                      <th className="py-2">Ultimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bottomBrands.map((row) => (
                      <tr key={row.brandId} className="border-t border-slate-100">
                        <td className="py-2">
                          <div className="font-medium text-slate-900">{row.brandName}</div>
                          <div className="text-xs text-slate-500">
                            {row.domain || '—'}
                            {row.industry ? ` · ${row.industry}` : ''}
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadge(row.latestScore)}`}>
                            {row.latestScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-slate-500">{formatDate(row.latestAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportSection>
          </div>

          <ReportSection
            title="Cleexs Score promedio por industria"
            description="Top 12 industrias por volumen de reportes."
          >
            {data.industries.length === 0 ? (
              <p className="text-sm text-slate-500">Sin datos de industria en la ventana.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Industria</th>
                    <th className="py-2 text-right">Reportes</th>
                    <th className="py-2 text-right">Score promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.industries.map((row) => (
                    <tr key={row.industry} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-700">{row.industry}</td>
                      <td className="py-2 text-right tabular-nums text-slate-900">{row.runs}</td>
                      <td className="py-2 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadge(row.avgScore)}`}>
                          {row.avgScore.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ReportSection>
        </>
      ) : null}
    </div>
  );
}
