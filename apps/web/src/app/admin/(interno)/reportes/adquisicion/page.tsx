'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Globe2,
  Mail,
  MousePointerClick,
  Sparkles,
  Users,
} from 'lucide-react';
import { internalReportsApi, type AcquisitionReport, type ReportWindowDays } from '@/lib/api';
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

export default function AcquisitionReportPage() {
  const [data, setData] = useState<AcquisitionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<ReportWindowDays>(30);

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

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

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
            title="Ultimos diagnosticos"
            description="Los 25 diagnosticos mas recientes en la ventana. Ver reporte abre /ver-resultado igual que el usuario."
            action={
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Users className="h-3.5 w-3.5" />
                {data.latestDiagnostics.length}
              </span>
            }
          >
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
                  {data.latestDiagnostics.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
                        Sin diagnosticos en la ventana.
                      </td>
                    </tr>
                  ) : (
                    data.latestDiagnostics.map((row) => (
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
                              <span className="font-medium text-slate-800">
                                {row.referrerName || row.refCode}
                              </span>
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
                          <DiagnosticReportLink
                            diagnosticId={row.id}
                            tier={row.tier}
                            status={row.status}
                          />
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
