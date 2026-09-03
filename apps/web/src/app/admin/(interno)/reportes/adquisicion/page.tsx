'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Globe2,
  Loader2,
  Mail,
  MousePointerClick,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  internalReportsApi,
  type AcquisitionDiagnosticRow,
  type AcquisitionReport,
  type ReportWindowDays,
} from '@/lib/api';
import {
  MiniBars,
  ReportErrorBanner,
  ReportLoading,
  ReportMetric,
  ReportRefreshButton,
  DiagnosticReportLink,
  ReportSection,
  ReferrerNameCell,
  SponsorBreakdownTable,
  WindowDaysToggle,
  formatDate,
  formatDateShort,
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

function DiagnosticsTableBody({
  rows,
  emptyMessage = 'Sin resultados.',
}: {
  rows: AcquisitionDiagnosticRow[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-slate-100 align-top">
          <td className="py-2 text-xs text-slate-500">{formatDate(row.createdAt)}</td>
          <td className="py-2">
            <div className="font-medium text-slate-900">{row.brandName}</div>
            <div className="text-xs text-slate-500">{row.domain}</div>
          </td>
          <td className="py-2 text-xs text-slate-700">{row.email || '—'}</td>
          <td className="py-2 text-xs text-slate-600">{row.sourceChannel || 'web'}</td>
          <td className="py-2 text-xs text-slate-600">
            {row.refCode ? (
              <>
                <span className="font-medium text-slate-800">{row.referrerName || row.refCode}</span>
                {row.referrerName && row.referrerName !== row.refCode ? (
                  <span className="block font-mono text-[10px] text-slate-400">{row.refCode}</span>
                ) : null}
              </>
            ) : (
              '—'
            )}
            {row.utmSource ? (
              <span className="block text-[10px] text-slate-400">utm: {row.utmSource}</span>
            ) : null}
          </td>
          <td className="py-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                row.tier === 'gold'
                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
                  : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
              }`}
            >
              {row.tier || 'freemium'}
            </span>
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
          <td className="py-2">
            <DiagnosticReportLink diagnosticId={row.id} tier={row.tier} status={row.status} />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function AcquisitionReportPage() {
  const [data, setData] = useState<AcquisitionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<ReportWindowDays>(30);

  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [completedOnly, setCompletedOnly] = useState(true);
  const [searchRows, setSearchRows] = useState<AcquisitionDiagnosticRow[] | null>(null);
  const [searchMeta, setSearchMeta] = useState<{
    totalMatching: number;
    truncated: boolean;
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await internalReportsApi.acquisition(windowDays);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte de adquisicion.');
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  const runSearch = useCallback(async (query: string, onlyCompleted = completedOnly) => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchError('Escribí al menos 2 caracteres (marca, dominio o email).');
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setActiveQuery(q);
    try {
      const res = await internalReportsApi.searchDiagnostics({
        q,
        limit: 100,
        completedOnly: onlyCompleted,
      });
      setSearchRows(res.rows);
      setSearchMeta({ totalMatching: res.totalMatching, truncated: res.truncated });
    } catch (e) {
      setSearchRows([]);
      setSearchMeta(null);
      setSearchError(e instanceof Error ? e.message : 'No se pudo buscar diagnosticos.');
    } finally {
      setSearchLoading(false);
    }
  }, [completedOnly]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setActiveQuery(null);
    setSearchRows(null);
    setSearchMeta(null);
    setSearchError(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const tableRows = data?.latestDiagnostics ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Adquisicion y funnel</h2>
          <p className="text-xs text-slate-500">
            Datos del modulo de diagnostico publico, capturados en los ultimos {windowDays} dias.
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReportMetric
              label="Diagnosticos creados"
              value={data.totals.diagnosticsInWindow}
              Icon={Globe2}
              tone="sky"
              hint={`${data.totals.diagnosticsAllTime.toLocaleString()} historicos`}
            />
            <ReportMetric
              label="Completados"
              value={data.totals.completedInWindow}
              Icon={CheckCircle2}
              tone="emerald"
              hint={`${formatPercent(data.totals.completionRate)} completion`}
            />
            <ReportMetric
              label="Email capturado"
              value={data.totals.withEmailInWindow}
              Icon={Mail}
              tone="violet"
              hint={`${formatPercent(data.totals.emailCaptureRate)} de los creados`}
            />
            <ReportMetric
              label="Upgrade a Gold"
              value={data.totals.goldInWindow}
              Icon={Sparkles}
              tone="amber"
              hint={`${formatPercent(data.totals.goldUpgradeRate)} de los creados`}
            />
          </div>

          <ReportSection
            title="Evolucion diaria"
            description="Barras moradas = diagnosticos creados. Verdes = completados."
          >
            <MiniBars
              data={data.dailySeries.map((row) => ({
                label: row.date,
                value: row.created,
                secondary: row.completed,
              }))}
              height={120}
            />
            <div className="mt-3 flex justify-between text-[10px] text-slate-400">
              <span>{formatDateShort(data.dailySeries[0]?.date)}</span>
              <span>{formatDateShort(data.dailySeries[data.dailySeries.length - 1]?.date)}</span>
            </div>
          </ReportSection>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReportSection title="Canales de origen" description="De donde llegan los visitantes.">
              {data.channels.length === 0 ? (
                <p className="text-sm text-slate-500">Sin datos en la ventana seleccionada.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2">Canal</th>
                      <th className="py-2 text-right">Visitas</th>
                      <th className="py-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((row) => (
                      <tr key={row.channel} className="border-t border-slate-100">
                        <td className="py-2 font-medium text-slate-700">{row.channel}</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.count}</td>
                        <td className="py-2 text-right tabular-nums text-slate-500">{formatPercent(row.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportSection>

            <ReportSection title="Top UTM source" description="Origenes campaigna manuales/auto.">
              {data.topUtmSources.length === 0 ? (
                <p className="text-sm text-slate-500">Sin UTM en la ventana seleccionada.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2">Source</th>
                      <th className="py-2 text-right">Diagnosticos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUtmSources.map((row) => (
                      <tr key={row.source} className="border-t border-slate-100">
                        <td className="py-2 font-medium text-slate-700">{row.source}</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportSection>
          </div>

          <ReportSection
            title="Auspiciadores YouTube (Tipito, Herederos, Eldo)"
            description="Desglose web vs WhatsApp con emails capturados en la ventana."
          >
            <SponsorBreakdownTable rows={data.sponsorBreakdown ?? []} />
          </ReportSection>

          <ReportSection
            title="Top referidores (codigos ref=)"
            description="Cuantos visitantes trajo cada ref code, cuantos completaron y dejaron email."
            action={
              data.topReferrers.length > 0 ? (
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  {data.topReferrers.length} codigos activos
                </span>
              ) : null
            }
          >
            {data.topReferrers.length === 0 ? (
              <p className="text-sm text-slate-500">No hay clicks con ref= en esta ventana.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2">Auspiciador</th>
                      <th className="py-2 text-right">Visitas</th>
                      <th className="py-2 text-right">Completados</th>
                      <th className="py-2 text-right">Email</th>
                      <th className="py-2 text-right">Completion</th>
                      <th className="py-2">Ultimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topReferrers.map((row) => (
                      <tr key={row.refCode} className="border-t border-slate-100">
                        <td className="py-2">
                          <ReferrerNameCell
                            name={row.name}
                            refCode={row.refCode}
                            isSponsor={row.isSponsor}
                          />
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.visits}</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.completed}</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.capturedEmails}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-700">
                          {formatPercent(row.completionRate)}
                        </td>
                        <td className="py-2 text-xs text-slate-500">{formatDate(row.latestAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportSection>

          <ReportSection
            title="Diagnosticos"
            description={
              activeQuery
                ? `Resultados de búsqueda en los ${data.totals.diagnosticsAllTime.toLocaleString('es-AR')} diagnósticos históricos.`
                : `Ultimos 25 del periodo (${windowDays} dias). Buscá arriba para encontrar cualquier marca en todo el historico.`
            }
            action={
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Users className="h-3.5 w-3.5" />
                {activeQuery ? (searchRows?.length ?? 0) : tableRows.length}
              </span>
            }
          >
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-[200px] flex-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                  Buscar marca, dominio o email
                </span>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void runSearch(searchInput);
                    }}
                    placeholder="Ej. Chegaucho, chegaucho.es, juan@…"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </label>
              <label className="flex items-center gap-2 pb-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={completedOnly}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setCompletedOnly(next);
                    if (activeQuery) void runSearch(activeQuery, next);
                  }}
                />
                Solo completados (con reporte)
              </label>
              <div className="flex flex-wrap gap-2 pb-0.5">
                <button
                  type="button"
                  disabled={searchLoading}
                  onClick={() => void runSearch(searchInput)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar en todo el historico
                </button>
                {activeQuery ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <X className="h-4 w-4" />
                    Limpiar
                  </button>
                ) : null}
              </div>
            </div>

            {searchError ? (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {searchError}
              </p>
            ) : null}

            {activeQuery && !searchLoading && searchMeta ? (
              <p className="mb-3 text-xs text-slate-600">
                {searchMeta.totalMatching === 0 ? (
                  <>Ningún diagnóstico coincide con «{activeQuery}» en todo el historico.</>
                ) : (
                  <>
                    <span className="font-semibold text-slate-900">{searchMeta.totalMatching}</span> coincidencia
                    {searchMeta.totalMatching === 1 ? '' : 's'} en total
                    {searchMeta.truncated ? (
                      <> · mostrando las {searchRows?.length ?? 0} más recientes</>
                    ) : null}
                    {completedOnly ? ' · solo completados' : ''}
                  </>
                )}
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Marca / dominio</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Canal</th>
                    <th className="py-2">Ref / UTM</th>
                    <th className="py-2">Tier</th>
                    <th className="py-2">Estado</th>
                    <th className="py-2">Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {searchLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-600" />
                        Buscando en los {data.totals.diagnosticsAllTime.toLocaleString('es-AR')} diagnósticos…
                      </td>
                    </tr>
                  ) : (
                    <DiagnosticsTableBody
                      rows={activeQuery ? (searchRows ?? []) : tableRows}
                      emptyMessage={
                        activeQuery
                          ? 'Ningun diagnostico coincide. Probá otra marca, dominio o email.'
                          : 'Sin diagnosticos en la ventana.'
                      }
                    />
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
