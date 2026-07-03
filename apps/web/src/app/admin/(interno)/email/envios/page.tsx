'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  Mail,
  MailX,
  MousePointerClick,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { EmailEnviosFunnel } from '@/components/admin/email-envios-funnel';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200';
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';

type ResendSummary = {
  lastEvent: string | null;
  lastEventAt: string | null;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  complained: boolean;
  failed: boolean;
  deliveryDelayed: boolean;
  timeline: Array<{ eventType: string; occurredAt: string }>;
};

type BatchTotals = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
};

type ResendTotals = {
  withExternalId: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  noEventsYet: number;
};

type BatchListItem = {
  campaignSlug: string;
  firstSendAt: string | null;
  lastSendAt: string | null;
  totals: BatchTotals;
  resend: ResendTotals;
  mode: string | null;
  variant: string | null;
};

type RecipientRow = {
  id: string;
  recipientEmail: string;
  cleexsStatus: string;
  cleexsScore: number | null;
  externalId: string | null;
  errorMessage: string | null;
  sentAt: string;
  resend: ResendSummary | null;
};

type TriggerResult = {
  ok?: boolean;
  dryRun?: boolean;
  campaignSlug?: string;
  sent?: number;
  failed?: number;
  skipped?: number;
  errors?: Array<{ email: string; error: string }>;
  error?: string;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function cleexsStatusLabel(status: string) {
  const map: Record<string, string> = {
    sent: 'Enviado',
    failed: 'Falló',
    skipped: 'Omitido',
    pending: 'Pendiente',
  };
  return map[status] ?? status;
}

function cleexsStatusClass(status: string) {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-800 ring-rose-200';
  if (status === 'skipped') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-800 ring-amber-200';
}

function resendStageLabel(row: ResendSummary | null, externalId: string | null) {
  if (!externalId) return 'Sin ID Resend';
  if (!row) return 'Esperando webhook';
  if (row.bounced) return 'Rebotó';
  if (row.failed) return 'Falló (Resend)';
  if (row.complained) return 'Spam';
  if (row.clicked) return 'Clic';
  if (row.opened) return 'Abierto';
  if (row.delivered) return 'Entregado';
  if (row.lastEvent) return row.lastEvent;
  return 'Enviado';
}

function resendStageClass(row: ResendSummary | null, externalId: string | null) {
  if (!externalId) return 'bg-slate-100 text-slate-500 ring-slate-200';
  if (!row) return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (row.bounced || row.failed || row.complained) return 'bg-rose-50 text-rose-800 ring-rose-200';
  if (row.clicked) return 'bg-violet-50 text-violet-800 ring-violet-200';
  if (row.opened) return 'bg-indigo-50 text-indigo-800 ring-indigo-200';
  if (row.delivered) return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  return 'bg-sky-50 text-sky-700 ring-sky-200';
}

function StatPill({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const toneCls =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'bad'
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : 'border-slate-200 bg-white text-slate-800';
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneCls}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function AdminEmailEnviosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSlug = searchParams.get('batch')?.trim() || '';

  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState<{ batch: BatchListItem; recipients: RecipientRow[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [triggerDryRun, setTriggerDryRun] = useState(true);
  const [triggerLimit, setTriggerLimit] = useState(4);
  const [triggerBusy, setTriggerBusy] = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/batches?limit=40');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as { error?: string }).error || 'No se pudo cargar batches';
        if (looksLikeAdminAuthError(msg)) throw new Error('AUTH');
        throw new Error(msg);
      }
      setBatches((json as { batches?: BatchListItem[] }).batches ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH') setError('AUTH');
      else setError(e instanceof Error ? e.message : 'Error');
      setBatches([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (slug: string, silent = false) => {
    if (!slug) {
      setDetail(null);
      return;
    }
    if (!silent) setDetailLoading(true);
    try {
      const res = await adminUiFetch(`/api/admin-ui/email/batches/${encodeURIComponent(slug)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as { error?: string }).error || 'Batch no encontrado';
        if (looksLikeAdminAuthError(msg)) throw new Error('AUTH');
        throw new Error(msg);
      }
      setDetail(json as { batch: BatchListItem; recipients: RecipientRow[] });
      setError(null);
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH') setError('AUTH');
      else if (!silent) setError(e instanceof Error ? e.message : 'Error');
      setDetail(null);
    } finally {
      if (!silent) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    void loadDetail(selectedSlug);
  }, [selectedSlug, loadDetail]);

  useEffect(() => {
    if (!selectedSlug || !autoRefresh) return undefined;
    const id = window.setInterval(() => {
      void loadDetail(selectedSlug, true);
      void loadBatches();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [selectedSlug, autoRefresh, loadDetail, loadBatches]);

  const activeBatch = useMemo(() => {
    if (detail?.batch) return detail.batch;
    return batches.find((b) => b.campaignSlug === selectedSlug) ?? null;
  }, [detail, batches, selectedSlug]);

  function selectBatch(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('batch', slug);
    else params.delete('batch');
    router.push(`/admin/email/envios?${params.toString()}`);
  }

  async function runMonthlyTrigger() {
    setTriggerBusy(true);
    setTriggerError(null);
    setTriggerResult(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/monthly-score-emails/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: triggerDryRun,
          limit: triggerLimit,
          segment: 'all',
          variant: 'letter',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as TriggerResult;
      if (!res.ok) throw new Error(json.error || 'No se pudo disparar el batch');
      setTriggerResult(json);
      await loadBatches();
      if (!triggerDryRun && json.campaignSlug) {
        selectBatch(json.campaignSlug);
      }
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : 'Error');
    } finally {
      setTriggerBusy(false);
    }
  }

  if (error === 'AUTH') {
    return <AdminAuthExpiredCard />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Marketing</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Estado de envíos</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Embudo comercial de campañas de email y detalle operativo por batch (mensual, semanal, pruebas).
        </p>
      </header>

      <EmailEnviosFunnel />

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-50 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Detalle operativo por batch
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Prueba · carta mensual</h2>
            <p className="mt-1 text-sm text-slate-600">
              Dispara un batch pequeño con plantilla <strong>carta</strong> (mismo cron que producción).
            </p>
          </div>
          <Link href="/admin/email/templates" className={secondaryBtn}>
            Ver plantillas
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Límite</span>
            <input
              type="number"
              min={1}
              max={50}
              className={field}
              value={triggerLimit}
              onChange={(e) => setTriggerLimit(Math.min(50, Math.max(1, Number(e.target.value) || 4)))}
            />
          </label>
          <label className="flex items-end gap-2 pb-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={triggerDryRun}
              onChange={(e) => setTriggerDryRun(e.target.checked)}
            />
            <span className="text-sm text-slate-700">Solo simulación (dry run)</span>
          </label>
          <div className="flex items-end">
            <button type="button" className={primaryBtn} disabled={triggerBusy} onClick={() => void runMonthlyTrigger()}>
              {triggerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {triggerDryRun ? 'Simular batch' : 'Enviar batch real'}
            </button>
          </div>
        </div>

        {triggerError ? <p className="mt-3 text-sm text-rose-600">{triggerError}</p> : null}
        {triggerResult ? (
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(triggerResult, null, 2)}
          </pre>
        ) : null}
      </section>

      {error && error !== 'AUTH' ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Batches recientes</h2>
          <button type="button" className={secondaryBtn} disabled={listLoading} onClick={() => void loadBatches()}>
            {listLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
        </div>

        {listLoading && batches.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : batches.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Todavía no hay envíos registrados.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {batches.map((b) => {
              const active = b.campaignSlug === selectedSlug;
              return (
                <button
                  key={b.campaignSlug}
                  type="button"
                  onClick={() => selectBatch(b.campaignSlug)}
                  className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 ${
                    active ? 'bg-violet-50/60' : ''
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{b.campaignSlug}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {fmtDate(b.firstSendAt)} → {fmtDate(b.lastSendAt)}
                      {b.variant ? ` · ${b.variant}` : ''}
                      {b.mode ? ` · ${b.mode}` : ''}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs text-slate-600 sm:block">
                    <p>
                      Status: {b.totals.sent} enviados · {b.totals.failed} fallos
                    </p>
                    <p className="mt-0.5">
                      Resend: {b.resend.delivered} entregados · {b.resend.opened} abiertos
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedSlug ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{selectedSlug}</h2>
              {activeBatch ? (
                <p className="text-sm text-slate-500">
                  {activeBatch.totals.total} destinatarios · último envío {fmtDate(activeBatch.lastSendAt)}
                </p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh 10s
            </label>
          </div>

          {detailLoading && !detail ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle…
            </div>
          ) : null}

          {activeBatch ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatPill label="Enviados (Status)" value={activeBatch.totals.sent} tone="ok" />
              <StatPill label="Entregados (Resend)" value={activeBatch.resend.delivered} tone="ok" />
              <StatPill label="Abiertos" value={activeBatch.resend.opened} />
              <StatPill label="Clics" value={activeBatch.resend.clicked} />
              <StatPill label="Rebotes" value={activeBatch.resend.bounced} tone="bad" />
              <StatPill label="Fallos (Status)" value={activeBatch.totals.failed} tone="bad" />
              <StatPill label="Fallos Resend" value={activeBatch.resend.failed} tone="bad" />
              <StatPill label="Sin webhook aún" value={activeBatch.resend.noEventsYet} tone="warn" />
            </div>
          ) : null}

          {detail?.recipients?.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Destinatario</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Resend</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Enviado</th>
                      <th className="px-4 py-3 font-semibold">Timeline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.recipients.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.recipientEmail}</p>
                          {row.errorMessage ? (
                            <p className="mt-1 text-xs text-rose-600">{row.errorMessage}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cleexsStatusClass(row.cleexsStatus)}`}
                          >
                            {cleexsStatusLabel(row.cleexsStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${resendStageClass(row.resend, row.externalId)}`}
                          >
                            {row.resend?.delivered ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : row.resend?.bounced || row.resend?.failed ? (
                              <XCircle className="h-3 w-3" />
                            ) : row.resend?.opened ? (
                              <Eye className="h-3 w-3" />
                            ) : row.resend?.clicked ? (
                              <MousePointerClick className="h-3 w-3" />
                            ) : row.externalId ? (
                              <Mail className="h-3 w-3" />
                            ) : (
                              <MailX className="h-3 w-3" />
                            )}
                            {resendStageLabel(row.resend, row.externalId)}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">
                          {row.cleexsScore != null ? row.cleexsScore : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(row.sentAt)}</td>
                        <td className="px-4 py-3">
                          {row.resend?.timeline?.length ? (
                            <ul className="space-y-0.5 text-xs text-slate-600">
                              {row.resend.timeline.map((ev, i) => (
                                <li key={`${row.id}-${i}`}>
                                  <span className="font-medium text-slate-700">{ev.eventType}</span>{' '}
                                  <span className="text-slate-400">{fmtDate(ev.occurredAt)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-center text-sm text-slate-500">Seleccioná un batch para ver el detalle por destinatario.</p>
      )}
    </div>
  );
}
