'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { addDaysToDayString, formatDayInArgentina } from '@cleexs/shared';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { EmailFunnelCard } from '@/components/admin/report-ui';

type FunnelStep = { count: number; pct: number | null; pctHint?: string };

type ClickRole = 'plans' | 'diagnostic' | 'report' | 'share' | 'other';

type AnalyticsReport = {
  ok: true;
  range: { from: string; to: string };
  funnel: {
    sent: FunnelStep;
    opened: FunnelStep;
    clicks: FunnelStep & { breakdown: Record<ClickRole, FunnelStep> };
    purchased: FunnelStep;
    delivered: FunnelStep;
  };
  byCampaign: Array<{
    campaignSlug: string;
    variant: string | null;
    label: string;
    kind?: 'scheduled' | 'test';
    sent: number;
    opened: number;
    clicksTotal: number;
    clicksBreakdown: Record<ClickRole, number>;
    purchased: number;
    delivered: number;
  }>;
  integrations: {
    resendWebhookSecretConfigured: boolean;
    note: string;
    scope?: string;
    resendEventsLast7Days?: Record<string, number>;
  };
};

type DetailFilter =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'clicked_plans'
  | 'clicked_diagnostic'
  | 'clicked_report'
  | 'clicked_share'
  | 'clicked_other'
  | 'purchased';

type RecipientRow = {
  id: string;
  recipientEmail: string;
  campaignSlug: string;
  variant: string | null;
  cleexsScore: number | null;
  sentAt: string;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  clicksBreakdown?: Record<ClickRole, boolean>;
  purchased: boolean;
  purchaseTemplate: string | null;
};

const FILTER_LABEL: Record<DetailFilter, string> = {
  sent: 'Enviados',
  delivered: 'Entregados (técnico)',
  opened: 'Abiertos',
  clicked: 'Clics (total)',
  clicked_plans: 'Clic en planes',
  clicked_diagnostic: 'Clic en diagnóstico',
  clicked_report: 'Clic en reporte',
  clicked_share: 'Clic en compartir',
  clicked_other: 'Clic en otros links',
  purchased: 'Compraron',
};

const CLICK_BREAKDOWN: Array<{ role: ClickRole; filter: DetailFilter; label: string }> = [
  { role: 'plans', filter: 'clicked_plans', label: 'Planes' },
  { role: 'diagnostic', filter: 'clicked_diagnostic', label: 'Diagnóstico' },
  { role: 'report', filter: 'clicked_report', label: 'Reporte' },
  { role: 'share', filter: 'clicked_share', label: 'Compartir' },
  { role: 'other', filter: 'clicked_other', label: 'Otros' },
];

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function pctLabel(p: number | null | undefined) {
  return p == null ? '—' : `${p}%`;
}

function rangeForPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30'): { from: string; to: string } {
  const today = formatDayInArgentina();
  if (preset === 'hoy') return { from: today, to: today };
  if (preset === 'ayer') {
    const yesterday = addDaysToDayString(today, -1);
    return { from: yesterday, to: yesterday };
  }
  const span = preset === '7' ? 6 : preset === '15' ? 14 : 29;
  return { from: addDaysToDayString(today, -span), to: today };
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function EmailEnviosFunnel() {
  const initial = useMemo(() => rangeForPreset('7'), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string | null>('7');
  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalFilter, setModalFilter] = useState<DetailFilter | null>(null);
  const [modalRows, setModalRows] = useState<RecipientRow[] | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await adminUiFetch(`/api/admin-ui/email/analytics${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'No se pudo cargar analytics');
      setData(json as AnalyticsReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30') {
    const r = rangeForPreset(preset);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(preset);
  }

  const openDetail = useCallback(
    async (filter: DetailFilter) => {
      setModalFilter(filter);
      setModalLoading(true);
      setModalError(null);
      setModalRows(null);
      try {
        const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&filter=${encodeURIComponent(filter)}`;
        const res = await adminUiFetch(`/api/admin-ui/email/analytics/recipients${qs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar detalle');
        setModalRows((json as { items?: RecipientRow[] }).items ?? []);
      } catch (e) {
        setModalError(e instanceof Error ? e.message : 'Error');
      } finally {
        setModalLoading(false);
      }
    },
    [from, to]
  );

  const f = data?.funnel;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
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
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activePreset === key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Desde
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Hasta
            <input
              type="date"
              value={to}
              min={from}
              max={formatDayInArgentina()}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mb-0.5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {data && !data.integrations.resendWebhookSecretConfigured ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Webhook Resend sin configurar</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{data.integrations.note}</p>
          </div>
        </div>
      ) : data?.integrations.resendWebhookSecretConfigured ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Tracking activo: aperturas y clics vía Resend · links con utm_content (planes, compartir, etc.)
          </div>
          {data.integrations.scope ? (
            <p className="text-xs leading-relaxed text-slate-500">{data.integrations.scope}</p>
          ) : null}
          {data.integrations.resendEventsLast7Days &&
          Object.keys(data.integrations.resendEventsLast7Days).length > 0 ? (
            <p className="text-xs leading-relaxed text-slate-500">
              Eventos Resend (7 días):{' '}
              {Object.entries(data.integrations.resendEventsLast7Days)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([type, n]) => `${type.replace(/^email\./, '')} ${n}`)
                .join(' · ')}
            </p>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                No hay eventos Resend guardados en los últimos 7 días. Mañana validamos con un mail de prueba; hasta
                entonces aperturas y clics pueden quedar en 0.
              </p>
            </div>
          )}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <EmailFunnelCard
          icon={<Send className="h-4 w-4 text-violet-600" />}
          label="Enviados"
          value={fmt(f?.sent.count ?? 0)}
          hint={
            f?.delivered.count
              ? `${fmt(f.delivered.count)} entregados (${pctLabel(f.delivered.pct)})`
              : undefined
          }
          onClick={() => void openDetail('sent')}
          actionHint="Ver detalle"
        />
        <EmailFunnelCard
          icon={<Eye className="h-4 w-4 text-indigo-600" />}
          label="Abiertos"
          value={fmt(f?.opened.count ?? 0)}
          pct={pctLabel(f?.opened.pct ?? null)}
          pctHint={f?.opened.pctHint}
          onClick={() => void openDetail('opened')}
          actionHint="Ver detalle"
        />
        <EmailFunnelCard
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          label="Compraron"
          value={fmt(f?.purchased.count ?? 0)}
          pct={pctLabel(f?.purchased.pct ?? null)}
          pctHint={f?.purchased.pctHint}
          onClick={() => void openDetail('purchased')}
          actionHint="Ver detalle"
        />
      </section>

      <EmailClicksCard
        total={f?.clicks.count ?? 0}
        pct={pctLabel(f?.clicks.pct ?? null)}
        pctHint={f?.clicks.pctHint}
        breakdown={f?.clicks.breakdown}
        onOpenTotal={() => void openDetail('clicked')}
        onOpenRole={(filter) => void openDetail(filter)}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Por campaña</h2>
        <p className="mt-1 text-xs text-slate-500">
          Secuencia programada y batches de prueba (test-1, etc.). Las filas de prueba aparecen primero.
        </p>
        {!data?.byCampaign.length ? (
          <p className="mt-4 text-sm text-slate-500">Sin envíos de marketing en este período.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2">Campaña</th>
                  <th className="py-2 text-right">Enviados</th>
                  <th className="py-2 text-right">Abiertos</th>
                  <th className="py-2 text-right">Clics</th>
                  <th className="py-2 text-right">Planes</th>
                  <th className="py-2 text-right">Compartir</th>
                  <th className="py-2 text-right">Compras</th>
                </tr>
              </thead>
              <tbody>
                {data.byCampaign.map((row) => (
                  <tr
                    key={`${row.campaignSlug}-${row.variant || ''}`}
                    className={`border-t border-slate-100 ${row.kind === 'test' ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-900">{row.label}</div>
                        {row.kind === 'test' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Prueba
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">{row.campaignSlug}</div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.sent}</td>
                    <td className="py-2 text-right tabular-nums">{row.opened}</td>
                    <td className="py-2 text-right tabular-nums text-violet-700">{row.clicksTotal}</td>
                    <td className="py-2 text-right tabular-nums">{row.clicksBreakdown?.plans ?? 0}</td>
                    <td className="py-2 text-right tabular-nums text-sky-700">
                      {row.clicksBreakdown?.share ?? 0}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium text-emerald-700">{row.purchased}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalFilter ? (
        <DetailModal
          filter={modalFilter}
          loading={modalLoading}
          error={modalError}
          rows={modalRows}
          rangeFrom={from}
          rangeTo={to}
          onClose={() => {
            setModalFilter(null);
            setModalRows(null);
            setModalError(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EmailClicksCard({
  total,
  pct,
  pctHint,
  breakdown,
  onOpenTotal,
  onOpenRole,
}: {
  total: number;
  pct: string;
  pctHint?: string;
  breakdown?: Record<ClickRole, FunnelStep>;
  onOpenTotal: () => void;
  onOpenRole: (filter: DetailFilter) => void;
}) {
  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={onOpenTotal}
          className="group shrink-0 text-left focus:outline-none focus:ring-2 focus:ring-violet-200 rounded-lg -m-1 p-1"
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-700">
            <MousePointerClick className="h-4 w-4 shrink-0" />
            <span>Clics</span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{fmt(total)}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {pct !== '—' ? <span className="text-sm font-semibold text-emerald-600">{pct}</span> : null}
            {pctHint ? <span className="text-[10px] text-slate-400">{pctHint}</span> : null}
          </div>
          <p className="mt-1 text-[10px] font-semibold text-violet-600 opacity-80 group-hover:opacity-100">
            Ver detalle →
          </p>
        </button>

        <div className="min-w-0 flex-1 border-t border-violet-100 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Desglose por link
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CLICK_BREAKDOWN.map(({ role, filter, label }) => (
              <button
                key={role}
                type="button"
                onClick={() => onOpenRole(filter)}
                className="flex min-w-0 flex-col gap-1 rounded-xl border border-violet-100/80 bg-white/70 px-3 py-2.5 text-left transition hover:border-violet-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium leading-tight text-slate-600">
                  {role === 'share' ? <Share2 className="h-3 w-3 shrink-0 text-sky-500" /> : null}
                  <span className="truncate">{label}</span>
                </span>
                <span className="text-xl font-bold tabular-nums text-slate-900">
                  {fmt(breakdown?.[role]?.count ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailModal({
  filter,
  loading,
  error,
  rows,
  rangeFrom,
  rangeTo,
  onClose,
}: {
  filter: DetailFilter;
  loading: boolean;
  error: string | null;
  rows: RecipientRow[] | null;
  rangeFrom: string;
  rangeTo: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center">
      <div className="relative my-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{FILTER_LABEL[filter]}</h2>
            <p className="text-xs text-slate-500">
              {rangeFrom} → {rangeTo}
              {!loading && !error ? ` · ${fmt(rows?.length ?? 0)} contactos` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : !rows?.length ? (
            <p className="text-sm text-slate-500">Nadie en este paso del funnel para el rango.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Campaña</th>
                  <th className="pb-2 text-right">Score</th>
                  {filter === 'purchased' ? <th className="pb-2">Template</th> : null}
                  {filter.startsWith('clicked') ? <th className="pb-2">Tipo de clic</th> : null}
                  <th className="pb-2">Enviado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{row.recipientEmail}</td>
                    <td className="py-2 text-xs text-slate-600">
                      <div>{row.variant || row.campaignSlug}</div>
                      <div className="font-mono text-[10px] text-slate-400">{row.campaignSlug}</div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.cleexsScore ?? '—'}</td>
                    {filter === 'purchased' ? (
                      <td className="py-2 text-xs text-emerald-700">{row.purchaseTemplate || '—'}</td>
                    ) : null}
                    {filter.startsWith('clicked') ? (
                      <td className="py-2 text-xs text-violet-700">
                        {CLICK_BREAKDOWN.filter(({ role }) => row.clicksBreakdown?.[role])
                          .map(({ label }) => label)
                          .join(', ') || '—'}
                      </td>
                    ) : null}
                    <td className="py-2 text-xs text-slate-500">{fmtDateTime(row.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
