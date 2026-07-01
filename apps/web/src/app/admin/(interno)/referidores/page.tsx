'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Loader2,
  MousePointerClick,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { CLEEXS_APP_URL } from '@/lib/site';
import { normalizeTrackingValue, slugifySponsorLabel } from '@/lib/sponsor-link';

type ReferralRow = {
  id: string | null;
  registered: boolean;
  name: string;
  refCode: string;
  active: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  notes: string | null;
  targetUrl: string;
  shortUrlPath: string;
  clicks30d: number;
  diagnosticsStarted: number;
  capturedEmails: number;
  uniqueEmails: number;
  competitorsConfirmed: number;
  completedDiagnostics: number;
  completionRate: number;
  upsell1: number;
  upsell2: number;
  agente250: number;
  latestAt: string;
  createdAt: string | null;
  updatedAt: string | null;
  isUnattributed?: boolean;
};

type ReferralDashboard = {
  generatedAt: string;
  windowDays: number;
  summary?: {
    totalUniqueEmails: number;
    attributedUniqueEmails: number;
    unattributedUniqueEmails: number;
    note?: string;
  };
  rows: ReferralRow[];
};

const SIN_REFERIDOR_SLUG = '__sin_referidor__';
type ListFilter = 'ranking' | 'campanas' | 'todos';

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200';
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

function emptyForm() {
  return {
    id: '',
    name: '',
    refCode: '',
    utmSource: 'auspiciador',
    utmMedium: 'link',
    utmCampaign: '',
    notes: '',
    active: true,
  };
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function shortUrlFor(refCode: string) {
  return `${CLEEXS_APP_URL.replace(/\/$/, '')}/r/${encodeURIComponent(refCode)}`;
}

function csvEscape(value: unknown) {
  const s = `${value ?? ''}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('es-AR');
}

export default function AdminReferidoresPage() {
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [listFilter, setListFilter] = useState<ListFilter>('ranking');

  const allRows = dashboard?.rows ?? [];
  const rows = useMemo(() => {
    if (listFilter === 'todos') return allRows;
    if (listFilter === 'campanas') return allRows.filter((r) => r.registered);
    return allRows.filter((r) => r.uniqueEmails > 0 && !r.isUnattributed);
  }, [allRows, listFilter]);

  const summary = dashboard?.summary;
  const totalUniqueEmails = summary?.totalUniqueEmails ?? allRows.reduce((s, r) => s + r.uniqueEmails, 0);
  const attributedUniqueEmails = summary?.attributedUniqueEmails ?? 0;
  const unattributedUniqueEmails = summary?.unattributedUniqueEmails ?? 0;
  const totalClicks = allRows.reduce((sum, row) => sum + row.clicks30d, 0);
  const totalStarted = allRows.reduce((sum, row) => sum + row.diagnosticsStarted, 0);
  const totalCompleted = allRows.reduce((sum, row) => sum + row.completedDiagnostics, 0);
  const overallConversion = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;

  const formShortUrl = useMemo(() => {
    const ref = normalizeTrackingValue(form.refCode);
    return ref ? shortUrlFor(ref) : '';
  }, [form.refCode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/referrals');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudo cargar referidores');
      setDashboard(data as ReferralDashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar referidores');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateName(name: string) {
    setForm((prev) => {
      const nextRef = prev.id ? prev.refCode : slugifySponsorLabel(name);
      return {
        ...prev,
        name,
        refCode: prev.refCode && prev.refCode !== slugifySponsorLabel(prev.name) ? prev.refCode : nextRef,
        utmCampaign: prev.utmCampaign || nextRef,
      };
    });
  }

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const refCode = normalizeTrackingValue(form.refCode);
      if (!refCode) throw new Error('Completá un ref válido.');
      const body = {
        name: form.name.trim(),
        refCode,
        utmSource: form.utmSource.trim() || 'auspiciador',
        utmMedium: form.utmMedium.trim() || 'link',
        utmCampaign: form.utmCampaign.trim() || refCode,
        notes: form.notes.trim() || undefined,
        active: form.active,
      };
      const path = form.id ? `/api/admin-ui/referrals/${encodeURIComponent(form.id)}` : '/api/admin-ui/referrals';
      const res = await adminUiFetch(path, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudo guardar');
      setMessage(form.id ? 'Campaña actualizada.' : 'Campaña creada.');
      setForm(emptyForm());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCampaign(row: ReferralRow) {
    if (!row.id) return;
    setError(null);
    try {
      const res = await adminUiFetch(`/api/admin-ui/referrals/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !row.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudo actualizar');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // ignore
    }
  }

  function edit(row: ReferralRow) {
    setForm({
      id: row.id ?? '',
      name: row.name,
      refCode: row.refCode,
      utmSource: row.utmSource || 'auspiciador',
      utmMedium: row.utmMedium || 'link',
      utmCampaign: row.utmCampaign || row.refCode,
      notes: row.notes || '',
      active: row.active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exportCsv() {
    const header = [
      'ref',
      'nombre',
      'campaña_registrada',
      'emails_unicos',
      'diagnosticos_con_email',
      'activo',
      'clicks_30d',
      'puso_url',
      'completados',
      'conversion_pct',
      'utm_medium',
      'link_corto',
      'link_destino',
    ];
    const lines = [
      header.map(csvEscape).join(','),
      ...rows.map((row) =>
        [
          row.refCode,
          row.name,
          row.registered ? 'si' : 'no',
          row.uniqueEmails,
          row.capturedEmails,
          row.active ? 'si' : 'no',
          row.clicks30d,
          row.diagnosticsStarted,
          row.completedDiagnostics,
          row.completionRate.toFixed(1),
          row.utmMedium || '',
          row.refCode === SIN_REFERIDOR_SLUG ? '' : shortUrlFor(row.refCode),
          row.targetUrl,
        ]
          .map(csvEscape)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleexs-referidores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <MousePointerClick className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Referidores</h1>
            <p className="text-sm text-slate-600">
              Ranking de auspiciadores por emails únicos. Cada canal necesita su propio código{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">ref</code> en el link.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refrescar
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Emails únicos (total)</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-violet-950">{formatNumber(totalUniqueEmails)}</p>
          <p className="mt-1 text-xs text-violet-800">
            {formatNumber(attributedUniqueEmails)} con referidor · {formatNumber(unattributedUniqueEmails)} sin ref
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Clicks últimos 30 días</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{formatNumber(totalClicks)}</p>
          <p className="mt-1 text-xs text-slate-500">Llegadas al link <code className="font-mono text-[10px]">/r/&lt;ref&gt;</code></p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pusieron URL</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{formatNumber(totalStarted)}</p>
          <p className="mt-1 text-xs text-slate-500">Diagnósticos iniciados (histórico)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tasa de finalización</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{overallConversion.toFixed(1)}%</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
            <TrendingUp className="h-3 w-3" /> Completados / iniciaron
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {form.id ? 'Editar campaña' : 'Nueva campaña'}
              </h2>
              <p className="text-xs text-slate-500">El link oficial será <code className="font-mono text-[10px]">/r/&lt;ref&gt;</code></p>
            </div>
          </header>
          <form className="space-y-4 p-5" onSubmit={saveCampaign}>
            <label className="block">
              <span className={labelCls}>Nombre del referidor</span>
              <input
                className={field}
                value={form.name}
                onChange={(e) => updateName(e.target.value)}
                placeholder="Ej. Herederos Radio"
                required
              />
              <span className="mt-1 block text-[11px] text-slate-500">Dónde compraste publicidad / quién comparte el link.</span>
            </label>

            <label className="block">
              <span className={labelCls}>Código ref</span>
              <input
                className={`${field} font-mono`}
                value={form.refCode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    refCode: e.target.value,
                    utmCampaign: prev.utmCampaign || normalizeTrackingValue(e.target.value) || '',
                  }))
                }
                placeholder="herederos5"
                required
              />
              <span className="mt-1 block text-[11px] text-slate-500">Letras minúsculas, números, guión y guión bajo.</span>
            </label>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <label className="block">
                <span className={labelCls}>utm_source</span>
                <input
                  className={field}
                  value={form.utmSource}
                  onChange={(e) => setForm((p) => ({ ...p, utmSource: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className={labelCls}>utm_medium</span>
                <input
                  className={field}
                  value={form.utmMedium}
                  onChange={(e) => setForm((p) => ({ ...p, utmMedium: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className={labelCls}>utm_campaign</span>
                <input
                  className={field}
                  value={form.utmCampaign}
                  onChange={(e) => setForm((p) => ({ ...p, utmCampaign: e.target.value }))}
                />
              </label>
            </div>

            <label className="block">
              <span className={labelCls}>Notas internas</span>
              <textarea
                className={`${field} min-h-[80px] resize-y`}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ej. Campaña Mayo, pauta podcast, contacto…"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              Campaña activa
            </label>

            {formShortUrl ? (
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Link corto</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-800">{formShortUrl}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {form.id ? 'Guardar cambios' : 'Crear campaña'}
              </button>
              {form.id ? (
                <button
                  type="button"
                  onClick={() => setForm(emptyForm())}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Ranking por auspiciador</h2>
              <p className="text-xs text-slate-500">
                Ordenado por emails únicos. Clicks: últimos {dashboard?.windowDays ?? 30} días · emails: histórico.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['ranking', 'Con emails'],
                ['campanas', 'Solo campañas'],
                ['todos', 'Todos'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setListFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    listFilter === key
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="text-xs text-slate-500">{rows.length} filas</span>
            </div>
          </header>

          <div className="overflow-x-auto">
            {loading && !dashboard ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                Cargando campañas…
              </div>
            ) : rows.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Todavía no hay campañas. Creá la primera para generar su link corto.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Auspiciador / ref</th>
                    <th className="px-3 py-3 text-right">Emails únicos</th>
                    <th className="px-3 py-3 text-right">Clicks</th>
                    <th className="px-3 py-3 text-right">URL</th>
                    <th className="px-3 py-3 text-right">Compl.</th>
                    <th className="px-3 py-3 text-right">% Conv.</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => {
                    const shortUrl = row.refCode === SIN_REFERIDOR_SLUG ? '' : shortUrlFor(row.refCode);
                    const isTopEmail = row.uniqueEmails > 0 && listFilter === 'ranking';
                    return (
                      <tr
                        key={row.refCode}
                        className={`align-top hover:bg-slate-50/40 ${isTopEmail ? 'bg-violet-50/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="mt-0.5 font-mono text-xs text-slate-500">{row.refCode}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span
                              className={`rounded-full px-2 py-0.5 ring-1 ${
                                row.active
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                  : 'bg-slate-100 text-slate-500 ring-slate-200'
                              }`}
                            >
                              {row.active ? 'Activa' : 'Pausada'}
                            </span>
                            {!row.registered ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">
                                Sin alta
                              </span>
                            ) : null}
                            <span className="text-slate-400">{formatDate(row.latestAt)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-lg font-bold tabular-nums text-violet-700">
                            {formatNumber(row.uniqueEmails)}
                          </span>
                          {row.capturedEmails > row.uniqueEmails ? (
                            <p className="text-[10px] text-slate-400">{formatNumber(row.capturedEmails)} diag.</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatNumber(row.clicks30d)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatNumber(row.diagnosticsStarted)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatNumber(row.completedDiagnostics)}</td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${
                              row.completionRate >= 50
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : row.completionRate >= 20
                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                : 'bg-slate-100 text-slate-600 ring-slate-200'
                            }`}
                          >
                            {row.completionRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.refCode === SIN_REFERIDOR_SLUG ? (
                            <span className="text-xs text-slate-400">Sin link de campaña</span>
                          ) : (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => void copy(shortUrl, `copy-${row.refCode}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              {copied === `copy-${row.refCode}` ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              Copiar
                            </button>
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              <Eye className="h-3 w-3" />
                              Probar
                            </a>
                            {row.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => edit(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void toggleCampaign(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                  {row.active ? (
                                    <PauseCircle className="h-3 w-3" />
                                  ) : (
                                    <PlayCircle className="h-3 w-3 text-emerald-600" />
                                  )}
                                  {row.active ? 'Pausar' : 'Activar'}
                                </button>
                              </>
                            ) : (
                              <a
                                href={row.targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Destino
                              </a>
                            )}
                          </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <footer className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
            Emails únicos = personas distintas. Si un canal no tiene fila propia, comparte link con otro o el usuario entró sin{' '}
            <code className="rounded bg-slate-200 px-1">ref</code> en la URL (ver fila «Sin referidor» en Todos).
          </footer>
        </section>
      </div>
    </div>
  );
}
