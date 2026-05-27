'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import {
  internalReportsApi,
  type WeeklyEmailLogStatus,
  type WeeklyEmailsStatsReport,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

const WINDOW_OPTIONS = [
  { value: 7, label: 'Últimos 7 días' },
  { value: 30, label: 'Últimos 30 días' },
  { value: 90, label: 'Últimos 90 días' },
  { value: 180, label: 'Últimos 180 días' },
] as const;

const STATUS_LABEL: Record<WeeklyEmailLogStatus, string> = {
  sent: 'Enviado',
  failed: 'Falló',
  skipped: 'Saltado',
  pending: 'Pendiente',
};

const STATUS_BADGE: Record<WeeklyEmailLogStatus, string> = {
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  skipped: 'bg-slate-100 text-slate-600 ring-slate-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const SEGMENT_LABEL: Record<string, string> = {
  free: 'Free',
  premium: 'Premium',
  all: 'Todos',
};

function formatNumber(n: number): string {
  return n.toLocaleString('es-AR');
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'recién';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days} d`;
    return formatDateTime(iso);
  } catch {
    return '—';
  }
}

export default function AdminWeeklyEmailsPage() {
  const [data, setData] = useState<WeeklyEmailsStatsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(90);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await internalReportsApi.weeklyEmailsStats({
        windowDays,
        campaignLimit: 12,
        recipientsLimit: 50,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las estadísticas.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const allTime = data?.allTime;
  const windowStats = data?.window;
  const campaigns = data?.campaigns ?? [];
  const recipients = data?.recentRecipients ?? [];

  const successRate = useMemo(() => {
    if (!allTime || allTime.total === 0) return 0;
    return (allTime.sent / allTime.total) * 100;
  }, [allTime]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Emails semanales</h1>
            <p className="text-sm text-slate-600">
              Estadística de los emails de la secuencia automática (campañas que arrancan con{' '}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs">weekly-</code>).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="hidden sm:inline">Ventana</span>
            <select
              value={windowDays}
              onChange={(ev) => setWindowDays(Number(ev.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refrescar
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">No se pudieron cargar los datos</p>
            <p className="mt-1 text-xs text-rose-600">{error}</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Send className="h-4 w-4 text-emerald-600" />}
          label="Enviados (histórico)"
          value={formatNumber(allTime?.sent ?? 0)}
          hint={`${formatNumber(allTime?.total ?? 0)} totales · ${formatPercent(successRate)} éxito`}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-sky-600" />}
          label="Enviados últimos 7 días"
          value={formatNumber(windowStats?.sentLast7 ?? 0)}
          hint={`${formatNumber(windowStats?.sentToday ?? 0)} hoy · ${formatNumber(windowStats?.total ?? 0)} eventos en ventana`}
        />
        <KpiCard
          icon={<XCircle className="h-4 w-4 text-rose-600" />}
          label="Fallos en ventana"
          value={formatNumber(windowStats?.failed ?? 0)}
          hint={`${formatNumber(windowStats?.skipped ?? 0)} saltados · ${formatNumber(windowStats?.pending ?? 0)} pendientes`}
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4 text-violet-600" />}
          label="Última corrida"
          value={formatRelative(allTime?.lastSendAt ?? null)}
          hint={allTime?.lastCampaignSlug || data?.cron.scheduleHint || '—'}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Corridas recientes</h2>
            <p className="text-xs text-slate-500">
              Agrupado por campaña ({data?.campaignsTracked ?? 0} en la ventana). El cron real corre los{' '}
              {data?.cron.scheduleHint ?? 'martes 13:00 UTC (10:00 AR)'}.
            </p>
          </div>
          <div className="text-xs text-slate-500">{campaigns.length} mostradas</div>
        </header>
        <div className="overflow-x-auto">
          {loading && !data ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Cargando corridas…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Todavía no hay corridas de weekly en esta ventana.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Campaña</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Segmento</th>
                  <th className="px-3 py-3 text-right">Destinatarios</th>
                  <th className="px-3 py-3 text-right">Enviados</th>
                  <th className="px-3 py-3 text-right">Fallos</th>
                  <th className="px-3 py-3 text-right">Saltados</th>
                  <th className="px-3 py-3 text-right">% Éxito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {campaigns.map((c) => (
                  <tr key={c.campaignSlug} className="align-top hover:bg-slate-50/40">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-800">{c.campaignSlug}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                        {c.weekSlot != null ? (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 ring-1 ring-violet-200">
                            week {c.weekSlot}
                          </span>
                        ) : null}
                        {c.mode ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ring-1 ring-slate-200">
                            {c.mode}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <div>{formatDateTime(c.lastSendAt)}</div>
                      <div className="text-[10px] text-slate-400">{formatRelative(c.lastSendAt)}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{c.segment ? SEGMENT_LABEL[c.segment] ?? c.segment : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatNumber(c.recipients)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-700">
                      {formatNumber(c.sent)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-rose-600">{formatNumber(c.failed)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-500">{formatNumber(c.skipped)}</td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${
                          c.successRate >= 90
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : c.successRate >= 60
                            ? 'bg-amber-50 text-amber-700 ring-amber-200'
                            : 'bg-rose-50 text-rose-700 ring-rose-200'
                        }`}
                      >
                        {formatPercent(c.successRate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Últimos envíos individuales</h2>
              <p className="text-xs text-slate-500">Hasta 50 más recientes (todas las campañas weekly).</p>
            </div>
          </div>
        </header>
        <div className="overflow-x-auto">
          {loading && !data ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Cargando envíos…
            </div>
          ) : recipients.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Todavía no hay envíos individuales registrados.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Destinatario</th>
                  <th className="px-3 py-3">Campaña</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recipients.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-slate-50/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.recipientEmail}</div>
                      {r.tenantCode ? (
                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">{r.tenantCode}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-xs text-slate-700">{r.campaignSlug}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                        {r.weekSlot != null ? <span>week {r.weekSlot}</span> : null}
                        {r.segment ? <span>· {SEGMENT_LABEL[r.segment] ?? r.segment}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                          STATUS_BADGE[r.status]
                        }`}
                      >
                        {r.status === 'sent' ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {r.status === 'failed' ? <XCircle className="h-3 w-3" /> : null}
                        {r.status === 'skipped' ? <Clock className="h-3 w-3" /> : null}
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <div>{formatDateTime(r.createdAt)}</div>
                      <div className="text-[10px] text-slate-400">{formatRelative(r.createdAt)}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {r.errorMessage ? (
                        <span className="block max-w-xs truncate text-rose-600" title={r.errorMessage}>
                          {r.errorMessage}
                        </span>
                      ) : r.externalId ? (
                        <span className="font-mono text-[10px] text-slate-400">{r.externalId}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-xs leading-relaxed text-slate-600">
        <p>
          <strong className="font-semibold text-slate-800">¿Cómo funciona?</strong> Cada martes a las{' '}
          {data?.cron.scheduleHint ?? '10:00 AR'} un cron de GitHub Actions llama al endpoint{' '}
          <code className="rounded bg-white px-1 font-mono text-[10px]">POST /api/cron/weekly-emails</code> con un
          secret compartido. Esa corrida arma la lista de destinatarios, genera el cuerpo del mail según el slot de la
          semana (1 a 4) y delega el envío en Resend. Cada destinatario queda guardado en{' '}
          <code className="rounded bg-white px-1 font-mono text-[10px]">cleexs_internal_email_send_logs</code> con su
          estado (<em>sent / failed / skipped / pending</em>), y eso es lo que ves en estas tablas.
        </p>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
