'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Inbox,
  Mail,
  MailCheck,
  MailX,
  MousePointerClick,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { internalReportsApi, type EmailOutreachReport, type ReportWindowDays } from '@/lib/api';
import {
  MiniBars,
  ReportErrorBanner,
  ReportLoading,
  ReportMetric,
  ReportRefreshButton,
  ReportSection,
  WindowDaysToggle,
  formatDateShort,
  formatPercent,
} from '@/components/admin/report-ui';

export default function EmailOutreachReportPage() {
  const [data, setData] = useState<EmailOutreachReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<ReportWindowDays>(30);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await internalReportsApi.emailOutreach(windowDays);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte de email.');
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
          <h2 className="text-lg font-semibold text-slate-900">Email y outreach</h2>
          <p className="text-xs text-slate-500">
            Performance de los dos canales en los ultimos {windowDays} dias.
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
          <ReportSection
            title="Estado de integraciones"
            description="Lo que necesita el sistema para trackear delivery, open y bounce."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  data.integrations.resendWebhookSecretConfigured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {data.integrations.resendWebhookSecretConfigured ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <div>
                  <p className="text-sm font-semibold">Resend webhook</p>
                  <p className="text-xs">
                    {data.integrations.resendWebhookSecretConfigured
                      ? 'Configurado (RESEND_WEBHOOK_SECRET).'
                      : 'Falta configurar RESEND_WEBHOOK_SECRET en el API.'}
                  </p>
                </div>
              </div>
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  data.integrations.outreachDomainVerified
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {data.integrations.outreachDomainVerified ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <div>
                  <p className="text-sm font-semibold">Dominio cleexsnet.com</p>
                  <p className="text-xs">
                    {data.integrations.outreachDomainVerified
                      ? 'Verificado, envio cold outreach en modo real habilitado.'
                      : 'No verificado: cold outreach corre en modo shadow.'}
                  </p>
                </div>
              </div>
            </div>
          </ReportSection>

          <ReportSection
            title="Weekly emails (semana / insights)"
            description="Envios automaticos a usuarios registrados."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ReportMetric
                label="Enviados"
                value={data.weekly.totals.sent}
                Icon={Send}
                tone="sky"
                hint={`${data.weekly.campaignsConfigured} campanas configuradas`}
              />
              <ReportMetric
                label="Saltados"
                value={data.weekly.totals.skipped}
                Icon={Inbox}
                tone="slate"
              />
              <ReportMetric
                label="Fallidos"
                value={data.weekly.totals.failed}
                Icon={MailX}
                tone="red"
              />
              <ReportMetric
                label="Pendientes"
                value={data.weekly.totals.pending}
                Icon={Mail}
                tone="amber"
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Envios diarios
                </h3>
                <MiniBars
                  data={data.weekly.dailySeries.map((row) => ({ label: row.date, value: row.sends }))}
                  height={100}
                />
                <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                  <span>{formatDateShort(data.weekly.dailySeries[0]?.date)}</span>
                  <span>
                    {formatDateShort(data.weekly.dailySeries[data.weekly.dailySeries.length - 1]?.date)}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Eventos Resend (por tipo)
                </h3>
                {Object.keys(data.weekly.eventsByType).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Sin eventos en la ventana. {!data.integrations.resendWebhookSecretConfigured ? 'Configura el secret.' : ''}
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(data.weekly.eventsByType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([evt, count]) => (
                          <tr key={evt} className="border-t border-slate-100">
                            <td className="py-1.5 font-mono text-xs text-slate-700">{evt}</td>
                            <td className="py-1.5 text-right tabular-nums text-slate-900">{count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </ReportSection>

          <ReportSection
            title="Cold outreach a competidores"
            description="Emails enviados desde leads/email a contactos descubiertos en competidores."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ReportMetric
                label="Enviados"
                value={data.outreach.totals.sent}
                Icon={Send}
                tone="sky"
                hint={`${data.outreach.totals.shadow} shadow / ${data.outreach.totals.real} real`}
              />
              <ReportMetric
                label="Delivered"
                value={data.outreach.totals.delivered}
                Icon={MailCheck}
                tone="emerald"
                hint={`${formatPercent(data.outreach.rates.deliveryRate)} delivery`}
              />
              <ReportMetric
                label="Open"
                value={data.outreach.totals.opened}
                Icon={Eye}
                tone="violet"
                hint={`${formatPercent(data.outreach.rates.openRate)} open rate`}
              />
              <ReportMetric
                label="Bounce / failed"
                value={data.outreach.totals.bounced + data.outreach.totals.failed}
                Icon={AlertTriangle}
                tone="red"
                hint={`${formatPercent(data.outreach.rates.bounceRate)} bounce`}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <ReportMetric
                label="Clicks"
                value={data.outreach.totals.clicked}
                Icon={MousePointerClick}
                tone="indigo"
              />
              <ReportMetric
                label="Drafts pendientes"
                value={data.outreach.totals.drafts}
                Icon={Inbox}
                tone="slate"
              />
              <ReportMetric
                label="Contactos totales"
                value={data.outreach.contactsAllTime}
                Icon={Mail}
                tone="slate"
                hint="historico de leads enriquecidos"
              />
              <ReportMetric
                label="Complaints"
                value={data.outreach.totals.complained}
                Icon={AlertTriangle}
                tone="rose"
              />
            </div>

            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Envios cold outreach diarios
              </h3>
              <MiniBars
                data={data.outreach.dailySeries.map((row) => ({ label: row.date, value: row.sends }))}
                height={100}
              />
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{formatDateShort(data.outreach.dailySeries[0]?.date)}</span>
                <span>
                  {formatDateShort(data.outreach.dailySeries[data.outreach.dailySeries.length - 1]?.date)}
                </span>
              </div>
            </div>
          </ReportSection>

          <ReportSection
            title="Top dominios outreach (por open rate)"
            description="Los dominios competidores donde mejor performean los emails."
          >
            {data.outreach.topDomains.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aun no hay opens registrados (necesitas dominio verificado + envios reales y webhook).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2">Dominio</th>
                      <th className="py-2 text-right">Enviados</th>
                      <th className="py-2 text-right">Open</th>
                      <th className="py-2 text-right">Open rate</th>
                      <th className="py-2 text-right">Click</th>
                      <th className="py-2 text-right">Click rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outreach.topDomains.map((row) => (
                      <tr key={row.domain} className="border-t border-slate-100">
                        <td className="py-2 font-mono text-xs text-slate-700">{row.domain}</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.sent}</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.opened}</td>
                        <td className="py-2 text-right tabular-nums text-violet-700">
                          {formatPercent(row.openRate)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{row.clicked}</td>
                        <td className="py-2 text-right tabular-nums text-indigo-700">
                          {formatPercent(row.clickRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportSection>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Para detalle por email individual ir a{' '}
              <a className="font-medium text-violet-700 hover:text-violet-900" href="/admin/outreach">
                /admin/outreach
              </a>{' '}
              o{' '}
              <a className="font-medium text-violet-700 hover:text-violet-900" href="/admin/email">
                /admin/email
              </a>
              .
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
