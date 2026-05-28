'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Settings,
  XCircle,
} from 'lucide-react';
import {
  internalReportsApi,
  type WeeklyEmailLogStatus,
  type WeeklyEmailsStatsReport,
} from '@/lib/api';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { CampaignContentEditor, type CampaignRow } from '@/components/admin/campaign-content-editor';

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

const DAY_LABEL: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

type WeeklySchedule = {
  enabled: boolean;
  dayOfWeekUtc: number;
  hourUtc: number;
  segment: 'all' | 'free' | 'premium';
  dryRun: boolean;
  notes: string | null;
  updatedAt: string;
};

// El offset de Argentina es UTC-3 todo el ano (no observa DST).
const AR_OFFSET_HOURS = -3;

function utcHourToAr(hourUtc: number) {
  const ar = (hourUtc + AR_OFFSET_HOURS + 24) % 24;
  return ar;
}

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

  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSavedAt, setScheduleSavedAt] = useState<number | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [weeklyCampaigns, setWeeklyCampaigns] = useState<CampaignRow[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

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

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/weekly-schedule');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar configuración');
      setSchedule(json as WeeklySchedule);
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Error');
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/campaigns');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error');
      const list = Array.isArray(json) ? (json as CampaignRow[]) : [];
      // Solo las 4 que usa el cron weekly: weekIndex 1..4, bucket = all.
      const filtered = list
        .filter((c) => c.weekIndex >= 1 && c.weekIndex <= 4 && c.scoreBucket === 'all')
        .sort((a, b) => a.weekIndex - b.weekIndex);
      setWeeklyCampaigns(filtered);
    } catch {
      setWeeklyCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSchedule();
    void loadCampaigns();
  }, [loadSchedule, loadCampaigns]);

  async function saveSchedule(patch: Partial<WeeklySchedule>) {
    if (!schedule) return;
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/weekly-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'No se pudo guardar');
      setSchedule(json as WeeklySchedule);
      setScheduleSavedAt(Date.now());
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Error');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveCampaignContent(
    c: CampaignRow,
    payload: { subject: string | null; body: string | null; preheader: string | null }
  ) {
    const res = await adminUiFetch(`/api/admin-ui/email/campaigns/${encodeURIComponent(c.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as { error?: string }).error || 'No se pudo guardar el contenido');
    }
    await loadCampaigns();
  }

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
              Agrupado por campaña ({data?.campaignsTracked ?? 0} en la ventana). El cron real corre{' '}
              {schedule
                ? `los ${DAY_LABEL[schedule.dayOfWeekUtc].toLowerCase()} a las ${schedule.hourUtc
                    .toString()
                    .padStart(2, '0')}:00 UTC`
                : data?.cron.scheduleHint ?? 'martes 13:00 UTC (10:00 AR)'}
              .
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

      <ScheduleCard
        schedule={schedule}
        loading={scheduleLoading}
        saving={scheduleSaving}
        savedAt={scheduleSavedAt}
        error={scheduleError}
        onSave={saveSchedule}
      />

      <WeeklyTemplatesCard
        campaigns={weeklyCampaigns}
        loading={campaignsLoading}
        expandedId={expandedCampaignId}
        onToggleExpand={(id) => setExpandedCampaignId((prev) => (prev === id ? null : id))}
        onSave={saveCampaignContent}
        onRefresh={() => void loadCampaigns()}
      />

      <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-xs leading-relaxed text-slate-600">
        <p>
          <strong className="font-semibold text-slate-800">¿Cómo funciona?</strong> Un cron en GitHub Actions llama
          cada hora al endpoint{' '}
          <code className="rounded bg-white px-1 font-mono text-[10px]">POST /api/cron/weekly-emails</code>. La API
          revisa la configuración de arriba (día, hora UTC y si está habilitado) y solo dispara el envío cuando
          coincide la ventana. Esa corrida arma la lista de destinatarios, genera el cuerpo del mail según el slot
          de la semana (1 a 4 — texto editable más abajo) y delega el envío en Resend. Cada destinatario queda
          guardado en{' '}
          <code className="rounded bg-white px-1 font-mono text-[10px]">cleexs_internal_email_send_logs</code> con su
          estado (<em>sent / failed / skipped / pending</em>).
        </p>
      </section>
    </div>
  );
}

function ScheduleCard({
  schedule,
  loading,
  saving,
  savedAt,
  error,
  onSave,
}: {
  schedule: WeeklySchedule | null;
  loading: boolean;
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  onSave: (patch: Partial<WeeklySchedule>) => Promise<void>;
}) {
  const [localDay, setLocalDay] = useState<number>(2);
  const [localHour, setLocalHour] = useState<number>(13);
  const [localEnabled, setLocalEnabled] = useState<boolean>(true);
  const [localSegment, setLocalSegment] = useState<'all' | 'free' | 'premium'>('free');
  const [localDryRun, setLocalDryRun] = useState<boolean>(false);

  useEffect(() => {
    if (!schedule) return;
    setLocalDay(schedule.dayOfWeekUtc);
    setLocalHour(schedule.hourUtc);
    setLocalEnabled(schedule.enabled);
    setLocalSegment(schedule.segment);
    setLocalDryRun(schedule.dryRun);
  }, [schedule]);

  const arHour = utcHourToAr(localHour);
  // Dia AR puede diferir si la hora UTC esta entre 00 y 02 (en AR seria dia anterior).
  const arDayShift = localHour + AR_OFFSET_HOURS < 0 ? -1 : 0;
  const arDay = (localDay + arDayShift + 7) % 7;

  async function handleSave() {
    await onSave({
      enabled: localEnabled,
      dayOfWeekUtc: localDay,
      hourUtc: localHour,
      segment: localSegment,
      dryRun: localDryRun,
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
          <Settings className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Configuración del envío automático</h2>
          <p className="text-xs text-slate-500">
            Cuándo se dispara la secuencia. El cron consulta esto cada hora y solo manda si coincide el día y la
            hora.
          </p>
        </div>
      </header>
      <div className="p-5">
        {loading && !schedule ? (
          <div className="text-sm text-slate-500">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Cargando configuración…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Día de envío (UTC)</span>
                <select
                  value={localDay}
                  onChange={(ev) => setLocalDay(Number(ev.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABEL[d]}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">
                  En Argentina: <strong className="text-slate-700">{DAY_LABEL[arDay]}</strong>
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hora (UTC)</span>
                <select
                  value={localHour}
                  onChange={(ev) => setLocalHour(Number(ev.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                >
                  {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">
                  En Argentina:{' '}
                  <strong className="text-slate-700">{arHour.toString().padStart(2, '0')}:00</strong>
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Segmento</span>
                <select
                  value={localSegment}
                  onChange={(ev) => setLocalSegment(ev.target.value as typeof localSegment)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="all">Todos</option>
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">Audiencia que recibirá la secuencia.</span>
              </label>
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={localEnabled}
                    onChange={(ev) => setLocalEnabled(ev.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  Envío automático activado
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={localDryRun}
                    onChange={(ev) => setLocalDryRun(ev.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  Solo simular (no enviar todavía)
                </label>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Próximo envío programado:{' '}
                <strong className="text-slate-800">
                  {DAY_LABEL[arDay]} a las {arHour.toString().padStart(2, '0')}:00 AR
                </strong>{' '}
                ({DAY_LABEL[localDay]} {localHour.toString().padStart(2, '0')}:00 UTC).{' '}
                {!localEnabled ? <span className="text-amber-700">Actualmente desactivado.</span> : null}
                {localDryRun ? <span className="ml-2 text-amber-700">Modo simulación.</span> : null}
              </p>
              <div className="flex items-center gap-3">
                {savedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    Guardado
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function WeeklyTemplatesCard({
  campaigns,
  loading,
  expandedId,
  onToggleExpand,
  onSave,
  onRefresh,
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onSave: (
    c: CampaignRow,
    payload: { subject: string | null; body: string | null; preheader: string | null }
  ) => Promise<void>;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Plantillas de la secuencia (semanas 1–4)</h2>
            <p className="text-xs text-slate-500">
              Editá lo que reciben los destinatarios cada semana. Si dejás un campo vacío, se usa el texto por
              defecto de esa semana.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refrescar
        </button>
      </header>
      <div className="space-y-3 p-5">
        {loading && campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Cargando plantillas…
          </p>
        ) : campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
            Todavía no hay campañas weekly con bucket{' '}
            <code className="rounded bg-white px-1 font-mono text-[10px]">all</code>. Andá a{' '}
            <a className="font-medium text-violet-700 underline" href="/admin/email">
              Email · secuencia
            </a>{' '}
            y tocá «Crear plantillas 1–8» para generarlas.
          </p>
        ) : (
          campaigns.map((c) => {
            const isOpen = expandedId === c.id;
            const hasCustom = Boolean((c.subject || '').trim() || (c.body || '').trim());
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/40">
                <button
                  type="button"
                  onClick={() => onToggleExpand(c.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
                      W{c.weekIndex}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Semana {c.weekIndex} · {c.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">{c.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        hasCustom
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-slate-100 text-slate-600 ring-slate-200'
                      }`}
                    >
                      {hasCustom ? 'Editado' : 'Por defecto'}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>
                {isOpen ? (
                  <div className="border-t border-slate-200 bg-white p-5">
                    <CampaignContentEditor c={c} onSave={(payload) => onSave(c, payload)} />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
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
