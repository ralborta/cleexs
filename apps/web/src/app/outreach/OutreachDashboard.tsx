'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { leadsApi, type OutreachEmailRow, type OutreachStats } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Eye, MailCheck, MailX, MousePointerClick, RefreshCw, Send, Inbox, ShieldAlert } from 'lucide-react';

type WindowDays = 7 | 30 | 90;

const STATUS_BADGES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  queued: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  sent: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  opened: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
  clicked: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200',
  bounced: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  complained: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  failed: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  delivery_delayed: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function MetricCard({
  label,
  value,
  Icon,
  hint,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  Icon: typeof Send;
  hint?: string;
  tone?: 'slate' | 'emerald' | 'sky' | 'violet' | 'amber' | 'red' | 'indigo';
}) {
  const toneClasses: Record<string, string> = {
    slate: 'text-slate-600',
    emerald: 'text-emerald-700',
    sky: 'text-sky-700',
    violet: 'text-violet-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    indigo: 'text-indigo-700',
  };
  return (
    <Card className="border-transparent bg-white shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${toneClasses[tone]}`}>{label}</p>
          <Icon className={`h-4 w-4 ${toneClasses[tone]}`} aria-hidden />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-[11px] leading-tight text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function OutreachDashboard() {
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [rows, setRows] = useState<OutreachEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modeFilter, setModeFilter] = useState<'' | 'shadow' | 'real'>('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([
        leadsApi.emailStats(windowDays),
        leadsApi.listEmails({ windowDays, limit: 80, status: statusFilter || undefined, mode: modeFilter || undefined }),
      ]);
      setStats(statsRes);
      setRows(listRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, [windowDays, statusFilter, modeFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const groupedByStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.status, (map.get(row.status) ?? 0) + 1);
    return map;
  }, [rows]);

  const limitProgress = useMemo(() => {
    if (!stats) return 0;
    if (stats.dailyLimit <= 0) return 0;
    return Math.min(100, Math.round((stats.todayRealSent / stats.dailyLimit) * 100));
  }, [stats]);

  return (
    <div className="space-y-5">
      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-lg text-foreground">Panel de envíos · cold outreach</CardTitle>
            <CardDescription className="mt-1">
              Estado real de cada email enviado a los competidores. Métricas en vivo desde Resend (delivered, opens, clicks, bounces).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-2">
              <span className="font-semibold text-slate-600">Ventana</span>
              <select
                value={windowDays}
                onChange={(ev) => setWindowDays(Number(ev.target.value) as WindowDays)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value={7}>7 días</option>
                <option value={30}>30 días</option>
                <option value={90}>90 días</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-1 text-slate-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(ev) => setAutoRefresh(ev.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Auto-refresh 30s
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3 w-3" />
              Refrescar
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          {stats ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Contactos totales" value={stats.totals.contacts} Icon={Inbox} tone="slate" />
                <MetricCard
                  label="Enviados hoy (real)"
                  value={`${stats.todayRealSent} / ${stats.dailyLimit}`}
                  Icon={Send}
                  tone={limitProgress > 80 ? 'amber' : 'sky'}
                  hint={`${limitProgress}% del límite diario`}
                />
                <MetricCard
                  label="Dominio verificado"
                  value={stats.domainVerified ? 'Sí' : 'No'}
                  Icon={stats.domainVerified ? CheckCircle2 : ShieldAlert}
                  tone={stats.domainVerified ? 'emerald' : 'amber'}
                  hint={stats.domainVerified ? 'Envío real habilitado' : 'Sólo shadow hasta verificar DNS'}
                />
                <MetricCard
                  label="Webhook Resend"
                  value={stats.resendWebhook.secretConfigured ? 'Conectado' : 'Pendiente'}
                  Icon={stats.resendWebhook.secretConfigured ? CheckCircle2 : AlertTriangle}
                  tone={stats.resendWebhook.secretConfigured ? 'emerald' : 'amber'}
                  hint={
                    stats.resendWebhook.secretConfigured
                      ? `${stats.resendWebhook.eventsTotalLastWindow} eventos en ${stats.windowDays}d`
                      : 'Faltan métricas delivered/opened/clicked'
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricCard label="Drafts" value={stats.totals.drafts} Icon={Inbox} tone="slate" />
                <MetricCard label="Enviados" value={stats.totals.sent} Icon={Send} tone="sky" />
                <MetricCard label="Entregados" value={stats.totals.delivered} Icon={MailCheck} tone="emerald" />
                <MetricCard label="Abiertos" value={stats.totals.opened} Icon={Eye} tone="violet" />
                <MetricCard label="Clicks" value={stats.totals.clicked} Icon={MousePointerClick} tone="indigo" />
                <MetricCard
                  label="Rebotes / fallos"
                  value={stats.totals.bounced + stats.totals.complained + stats.totals.failed}
                  Icon={MailX}
                  tone="red"
                  hint={
                    stats.totals.bounced + stats.totals.complained + stats.totals.failed > 0
                      ? `bounce ${stats.totals.bounced} · queja ${stats.totals.complained} · fail ${stats.totals.failed}`
                      : undefined
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-transparent bg-slate-50 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tasa de entrega</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{stats.rates.deliveryRate}%</p>
                  </CardContent>
                </Card>
                <Card className="border-transparent bg-slate-50 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tasa de apertura</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{stats.rates.openRate}%</p>
                  </CardContent>
                </Card>
                <Card className="border-transparent bg-slate-50 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tasa de clicks</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{stats.rates.clickRate}%</p>
                  </CardContent>
                </Card>
                <Card className="border-transparent bg-slate-50 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tasa de rebotes</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{stats.rates.bounceRate}%</p>
                  </CardContent>
                </Card>
              </div>

              {stats.resendWebhook.secretConfigured ? (
                <Card className="border-transparent bg-indigo-50/40 shadow-none">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-indigo-900">Resend webhook · engagement único</p>
                      <span className="text-[11px] text-indigo-700">
                        {stats.resendWebhook.matchedToOutreach} eventos matcheados a outreach
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {(
                        [
                          ['sent', 'Enviados'],
                          ['delivered', 'Entregados'],
                          ['opened', 'Abiertos'],
                          ['clicked', 'Clics'],
                          ['bounced', 'Rebotes'],
                          ['failed', 'Fallidos'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="rounded-md bg-white p-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">{label}</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">
                            {stats.resendWebhook.uniqueEmailsByStageLastWindow[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                  Para ver opens, clicks y bounces en tiempo real, configurá <code className="rounded bg-white px-1 font-mono">RESEND_WEBHOOK_SECRET</code> en Railway con el signing secret del webhook de Resend.
                </div>
              )}
            </>
          ) : loading ? (
            <p className="text-sm text-slate-500">Cargando métricas…</p>
          ) : null}

          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Últimos envíos</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="inline-flex items-center gap-1 text-slate-600">
                  Estado
                  <select
                    value={statusFilter}
                    onChange={(ev) => setStatusFilter(ev.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">Todos</option>
                    <option value="draft">draft</option>
                    <option value="sent">sent</option>
                    <option value="delivered">delivered</option>
                    <option value="opened">opened</option>
                    <option value="clicked">clicked</option>
                    <option value="bounced">bounced</option>
                    <option value="complained">complained</option>
                    <option value="failed">failed</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-1 text-slate-600">
                  Modo
                  <select
                    value={modeFilter}
                    onChange={(ev) => setModeFilter(ev.target.value as typeof modeFilter)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">Todos</option>
                    <option value="shadow">shadow</option>
                    <option value="real">real</option>
                  </select>
                </label>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center text-xs text-slate-500">
                No hay envíos en esta ventana.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="py-2 pr-2">Competidor</th>
                      <th className="py-2 pr-2">Destinatario</th>
                      <th className="py-2 pr-2">Modo</th>
                      <th className="py-2 pr-2">Estado</th>
                      <th className="py-2 pr-2">Resend</th>
                      <th className="py-2 pr-2">Asunto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/60">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(row.sentAt || row.createdAt)}</td>
                        <td className="py-2 pr-2 text-slate-800">
                          {row.competitor}
                          {row.competitorDomain ? <span className="block text-[10px] text-slate-500">{row.competitorDomain}</span> : null}
                        </td>
                        <td className="py-2 pr-2 text-slate-800">
                          {row.effectiveTo || row.contactEmail}
                          {row.mode === 'shadow' && row.originalTo ? (
                            <span className="block text-[10px] text-slate-500">orig: {row.originalTo}</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2 font-mono text-[10px] text-slate-700">{row.mode || '—'}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              STATUS_BADGES[row.status] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-[10px] text-slate-500">{row.lastResendEvent || '—'}</td>
                        <td className="max-w-[260px] truncate py-2 pr-2 text-slate-700" title={row.subject}>
                          {row.subject}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {groupedByStatus.size > 0 ? (
              <p className="mt-2 text-[10px] text-slate-500">
                {Array.from(groupedByStatus.entries())
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
