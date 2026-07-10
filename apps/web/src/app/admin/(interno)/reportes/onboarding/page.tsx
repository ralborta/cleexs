'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Download, Globe2, MessageCircle, UserRound, Users } from 'lucide-react';
import { internalReportsApi, type OnboardingProfileReport, type ReportWindowDays } from '@/lib/api';
import {
  ReportErrorBanner,
  ReportLoading,
  ReportMetric,
  ReportRefreshButton,
  ReportSection,
  WindowDaysToggle,
  formatDate,
  formatPercent,
} from '@/components/admin/report-ui';

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  detecting_competitors: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  awaiting_user: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  running: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  failed: 'bg-red-100 text-red-800 ring-1 ring-red-200',
};

function downloadCsv(rows: OnboardingProfileReport['rows']) {
  const header = ['fecha', 'marca', 'dominio', 'email', 'pais', 'nombre', 'como_llego', 'estado'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.createdAt,
        row.brandName,
        row.domain,
        row.email || '',
        row.country || '',
        row.displayName || '',
        row.howFoundLabel || row.howFoundUs || '',
        row.status,
      ]
        .map((v) => escape(String(v)))
        .join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `onboarding-perfil-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OnboardingProfileReportPage() {
  const [data, setData] = useState<OnboardingProfileReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<ReportWindowDays>(30);
  const [countryFilter, setCountryFilter] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await internalReportsApi.onboardingProfile(
        windowDays,
        countryFilter.trim() || undefined
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte de onboarding.');
    } finally {
      setLoading(false);
    }
  }, [windowDays, countryFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Onboarding · perfil de leads</h2>
          <p className="text-xs text-slate-500">
            Un lead por dominio (sin duplicar el mismo sitio). Un email con varias empresas sí puede
            aparecer más de una vez. Ventana: últimos {windowDays} días
            {countryFilter.trim() ? (
              <>
                {' '}
                · filtro: <span className="font-medium text-slate-700">{countryFilter}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Globe2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              disabled={loading}
              aria-label="Filtrar por país"
              className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
            >
              <option value="">Todos los países</option>
              {(data?.availableCountries ?? []).map((row) => (
                <option key={row.country} value={row.country}>
                  {row.country} ({row.count})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          <WindowDaysToggle value={windowDays} onChange={setWindowDays} disabled={loading} />
          {data && data.rows.length > 0 ? (
            <button
              type="button"
              onClick={() => downloadCsv(data.rows)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          ) : null}
          <ReportRefreshButton loading={loading} onClick={load} />
        </div>
      </div>

      {error ? <ReportErrorBanner message={error} /> : null}
      {loading && !data ? <ReportLoading /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReportMetric
              label="Dominios únicos"
              value={data.totals.withProfileData}
              Icon={Users}
              tone="violet"
              hint={
                data.totals.duplicateDomainsSkipped > 0
                  ? `${data.totals.duplicateDomainsSkipped} duplicado${data.totals.duplicateDomainsSkipped === 1 ? '' : 's'} omitido${data.totals.duplicateDomainsSkipped === 1 ? '' : 's'} · ${formatPercent(data.totals.profileRate)} del período`
                  : `${formatPercent(data.totals.profileRate)} de ${data.totals.diagnosticsInWindow} diagnósticos`
              }
            />
            <ReportMetric
              label="Con país"
              value={data.totals.withCountry}
              Icon={Globe2}
              tone="sky"
              hint={`${formatPercent(data.totals.countryRate)} del período`}
            />
            <ReportMetric
              label="Con nombre"
              value={data.totals.withName}
              Icon={UserRound}
              tone="emerald"
              hint={`${formatPercent(data.totals.nameRate)} del período`}
            />
            <ReportMetric
              label="Con cómo llegó"
              value={data.totals.withHowFound}
              Icon={MessageCircle}
              tone="amber"
              hint={`${formatPercent(data.totals.howFoundRate)} del período`}
            />
          </div>

          {data.howFoundBreakdown.length > 0 ? (
            <ReportSection
              title="Cómo nos encontraron"
              description="Solo entre quienes eligieron una opción en el wizard."
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.howFoundBreakdown.map((row) => (
                  <div
                    key={row.code}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-slate-800">{row.label}</span>
                    <span className="text-sm tabular-nums text-slate-600">
                      {row.count}{' '}
                      <span className="text-xs text-slate-400">({formatPercent(row.share)})</span>
                    </span>
                  </div>
                ))}
              </div>
            </ReportSection>
          ) : null}

          <ReportSection
            title="Leads con datos de onboarding"
            description={
              countryFilter.trim()
                ? `${data.rows.length} dominio${data.rows.length === 1 ? '' : 's'} único${data.rows.length === 1 ? '' : 's'} en ${countryFilter} (ventana ${windowDays}d).`
                : `${data.rows.length} dominio${data.rows.length === 1 ? '' : 's'} único${data.rows.length === 1 ? '' : 's'} en la ventana.`
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Marca / dominio</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">País</th>
                    <th className="py-2">Nombre</th>
                    <th className="py-2">Cómo llegó</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                        {countryFilter.trim()
                          ? `Sin leads con datos de onboarding para ${countryFilter} en este período.`
                          : 'Nadie dejó datos del onboarding en este período.'}
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 align-top">
                        <td className="py-2 text-xs text-slate-500">{formatDate(row.createdAt)}</td>
                        <td className="py-2">
                          <div className="font-medium text-slate-900">{row.brandName}</div>
                          <div className="text-xs text-slate-500">{row.domain}</div>
                        </td>
                        <td className="py-2 text-xs text-slate-700">{row.email || '—'}</td>
                        <td className="py-2 text-xs text-slate-700">{row.country || '—'}</td>
                        <td className="py-2 text-xs text-slate-700">{row.displayName || '—'}</td>
                        <td className="py-2 text-xs text-slate-700">
                          {row.howFoundLabel || row.howFoundUs || '—'}
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              STATUS_BADGES[row.status] || STATUS_BADGES.pending
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ReportSection>
        </>
      ) : null}
    </div>
  );
}
