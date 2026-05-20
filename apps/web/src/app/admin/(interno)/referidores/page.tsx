'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Link2,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { AdminAuthExpiredCard, AdminCallout, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { AdminPanelSection } from '@/components/admin/admin-panel-section';
import { Button } from '@/components/ui/button';
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
  competitorsConfirmed: number;
  completedDiagnostics: number;
  completionRate: number;
  upsell1: number;
  upsell2: number;
  agente250: number;
  latestAt: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type ReferralDashboard = {
  generatedAt: string;
  windowDays: number;
  rows: ReferralRow[];
};

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15';
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';
const panelOuter =
  'rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/[0.05] backdrop-blur-sm md:p-9';

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

export default function AdminReferidoresPage() {
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const rows = dashboard?.rows ?? [];
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks30d, 0);
  const totalStarted = rows.reduce((sum, row) => sum + row.diagnosticsStarted, 0);
  const totalCompleted = rows.reduce((sum, row) => sum + row.completedDiagnostics, 0);
  const totalEmails = rows.reduce((sum, row) => sum + row.capturedEmails, 0);

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
      'activo',
      'clicks_30d',
      'puso_url',
      'dio_email',
      'cambio_competidores',
      'completados',
      'conversion_pct',
      'upsell_1',
      'upsell_2',
      'agente250',
      'link_corto',
      'link_destino',
    ];
    const lines = [
      header.map(csvEscape).join(','),
      ...rows.map((row) =>
        [
          row.refCode,
          row.name,
          row.active ? 'si' : 'no',
          row.clicks30d,
          row.diagnosticsStarted,
          row.capturedEmails,
          row.competitorsConfirmed,
          row.completedDiagnostics,
          row.completionRate.toFixed(1),
          row.upsell1,
          row.upsell2,
          row.agente250,
          shortUrlFor(row.refCode),
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
    <div className={panelOuter}>
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Admin interno</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            Tracking URLs de referidores
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Creá campañas de tráfico, copiá links cortos con conteo de clicks y medí el embudo básico:
            clicks → puso URL → email → competidores → diagnóstico completado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-5">
          <AdminCallout variant="error">{error}</AdminCallout>
        </div>
      ) : null}
      {message ? (
        <div className="mt-5">
          <AdminCallout variant="success">{message}</AdminCallout>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Metric label="Clicks 30d" value={totalClicks} />
        <Metric label="Puso URL" value={totalStarted} />
        <Metric label="Emails" value={totalEmails} />
        <Metric label="Completados" value={totalCompleted} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
        <AdminPanelSection
          icon={Plus}
          title={form.id ? 'Editar campaña' : 'Nueva campaña'}
          description="Usá un ref corto y legible. El link oficial será /r/ref para poder contar clicks."
          accent="violet"
        >
          <form className="space-y-4" onSubmit={saveCampaign}>
            <label className="block">
              <span className={labelCls}>Nombre / sitio donde compro publicidad</span>
              <input
                className={field}
                value={form.name}
                onChange={(e) => updateName(e.target.value)}
                placeholder="Ej. Herederos Radio"
                required
              />
            </label>
            <label className="block">
              <span className={labelCls}>Ref</span>
              <input
                className={field}
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
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={labelCls}>utm_source</span>
                <input className={field} value={form.utmSource} onChange={(e) => setForm((p) => ({ ...p, utmSource: e.target.value }))} />
              </label>
              <label className="block">
                <span className={labelCls}>utm_medium</span>
                <input className={field} value={form.utmMedium} onChange={(e) => setForm((p) => ({ ...p, utmMedium: e.target.value }))} />
              </label>
              <label className="block">
                <span className={labelCls}>utm_campaign</span>
                <input className={field} value={form.utmCampaign} onChange={(e) => setForm((p) => ({ ...p, utmCampaign: e.target.value }))} />
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>Notas</span>
              <textarea
                className={`${field} min-h-[84px] resize-y`}
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
              Activa
            </label>
            {formShortUrl ? (
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Link corto</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-800">{formShortUrl}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="gap-2" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {form.id ? 'Guardar cambios' : 'Crear campaña'}
              </Button>
              {form.id ? (
                <Button type="button" variant="outline" onClick={() => setForm(emptyForm())}>
                  Cancelar edición
                </Button>
              ) : null}
            </div>
          </form>
        </AdminPanelSection>

        <AdminPanelSection
          icon={Link2}
          title="Campañas y conversión"
          description={`Ventana de clicks: últimos ${dashboard?.windowDays ?? 30} días. Diagnósticos: histórico reciente por ref.`}
          accent="indigo"
        >
          {loading && !dashboard ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando campañas…
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Todavía no hay campañas. Creá la primera para generar su link corto.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Ref</th>
                    <th className="px-3 py-3 text-right">Clicks</th>
                    <th className="px-3 py-3 text-right">URL</th>
                    <th className="px-3 py-3 text-right">Email</th>
                    <th className="px-3 py-3 text-right">Compet.</th>
                    <th className="px-3 py-3 text-right">Compl.</th>
                    <th className="px-3 py-3 text-right">% conv.</th>
                    <th className="px-3 py-3 text-right">Upsell 1</th>
                    <th className="px-3 py-3 text-right">Upsell 2</th>
                    <th className="px-3 py-3 text-right">Agente250</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => {
                    const shortUrl = shortUrlFor(row.refCode);
                    return (
                      <tr key={row.refCode} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="mt-0.5 font-mono text-xs text-slate-500">{row.refCode}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                            <span className={`rounded-full px-2 py-0.5 ${row.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {row.active ? 'activo' : 'pausado'}
                            </span>
                            {!row.registered ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">sin alta</span> : null}
                            <span>{formatDate(row.latestAt)}</span>
                          </div>
                        </td>
                        <NumberCell value={row.clicks30d} />
                        <NumberCell value={row.diagnosticsStarted} />
                        <NumberCell value={row.capturedEmails} />
                        <NumberCell value={row.competitorsConfirmed} />
                        <NumberCell value={row.completedDiagnostics} />
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {row.completionRate.toFixed(1)}%
                        </td>
                        <NumberCell value={row.upsell1} muted />
                        <NumberCell value={row.upsell2} muted />
                        <NumberCell value={row.agente250} muted />
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => void copy(shortUrl, `copy-${row.refCode}`)}>
                              {copied === `copy-${row.refCode}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              Copiar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" asChild>
                              <a href={shortUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Probar
                              </a>
                            </Button>
                            {row.id ? (
                              <>
                                <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => edit(row)}>
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => void toggleCampaign(row)}>
                                  {row.active ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                                  {row.active ? 'Pausar' : 'Activar'}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Upsell 1, Upsell 2 y Agente250 quedan visibles pero en cero hasta definir qué acción exacta del producto
            debe disparar cada evento.
          </p>
        </AdminPanelSection>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function NumberCell({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <td className={`px-3 py-3 text-right tabular-nums ${muted ? 'text-slate-400' : 'text-slate-700'}`}>
      {value}
    </td>
  );
}
