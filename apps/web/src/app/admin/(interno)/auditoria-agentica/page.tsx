'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  ScanSearch,
  Trash2,
} from 'lucide-react';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { AgenticAuditReport, type AgenticAuditResult } from '@/components/agentic-audit/audit-report';

export const dynamic = 'force-dynamic';

type AuditRow = {
  id: string;
  slug: string;
  targetUrl: string;
  siteLabel: string | null;
  clientEmail: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  overallScore: number | null;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AuditDetail = AuditRow & {
  resultJson: AgenticAuditResult | null;
  error: string | null;
  notes: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 ring-slate-200',
  running: 'bg-sky-100 text-sky-700 ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  failed: 'bg-rose-100 text-rose-700 ring-rose-200',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'En cola',
  running: 'Analizando…',
  completed: 'Lista',
  failed: 'Falló',
};

function publicLink(slug: string): string {
  if (typeof window === 'undefined') return `/auditoria/${slug}`;
  return `${window.location.origin}/auditoria/${slug}`;
}

export default function AuditoriaAgenticaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/agentic-audits');
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Error ${res.status}`);
      const data = (await res.json()) as { items?: AuditRow[] };
      setRows(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  if (selectedId) {
    return (
      <AuditDetailView
        id={selectedId}
        onBack={() => {
          setSelectedId(null);
          void loadList();
        }}
      />
    );
  }

  const totalListas = rows.filter((r) => r.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/60 p-6 shadow-sm md:p-8">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-violet-200/30 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-violet-100 shadow-sm">
              <ScanSearch className="h-6 w-6 text-violet-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500/80">
                Herramientas · Venta única
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                Auditoría Agéntica
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Generá una auditoría de legibilidad para agentes de IA (ChatGPT, Claude, Gemini,
                Perplexity) sobre el sitio de un cliente. Cuando esté lista, le pasás el link con el informe.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" /> Nueva auditoría
          </button>
        </div>
      </section>

      {showForm && (
        <NewAuditForm
          onCreated={() => {
            setShowForm(false);
            void loadList();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm">
          <p className="font-semibold">No se pudo cargar.</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Auditorías</h2>
            <p className="text-xs text-slate-500">
              {rows.length} en total · {totalListas} listas para entregar
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </header>

        {loading && rows.length === 0 ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-500" />
            <p className="mt-2 text-sm text-slate-500">Cargando…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <ScanSearch className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Todavía no hay auditorías</p>
            <p className="mt-1 text-xs text-slate-500">Creá la primera con “Nueva auditoría”.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-slate-50/70"
                onClick={() => setSelectedId(row.id)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                  {row.overallScore != null ? (
                    <span className="text-sm font-bold tabular-nums text-slate-700">{row.overallScore}</span>
                  ) : (
                    <ScanSearch className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.siteLabel || row.targetUrl}
                  </p>
                  <p className="truncate text-xs text-slate-500">{row.targetUrl}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  {row.paidAt && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                      Pagada
                    </span>
                  )}
                  {row.deliveredAt && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-200">
                      Entregada
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                    STATUS_BADGE[row.status] || STATUS_BADGE.pending
                  }`}
                >
                  {STATUS_LABEL[row.status] || row.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewAuditForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [targetUrl, setTargetUrl] = useState('');
  const [siteLabel, setSiteLabel] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!targetUrl.trim()) {
      setErr('Pegá la URL del sitio a auditar.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/agentic-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          siteLabel: siteLabel.trim() || null,
          clientEmail: clientEmail.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Error ${res.status}`);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error creando la auditoría');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100';
  const label = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/30 p-6 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Nueva auditoría</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        El análisis corre en segundo plano (~30-60s). Vas a verlo como “Lista” cuando termine.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>URL del sitio *</label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://www.cliente.com"
            className={field}
          />
        </div>
        <div>
          <label className={label}>Nombre del cliente / sitio</label>
          <input
            type="text"
            value={siteLabel}
            onChange={(e) => setSiteLabel(e.target.value)}
            placeholder="Se completa solo con el dominio"
            className={field}
          />
        </div>
        <div>
          <label className={label}>Email del cliente (opcional)</label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="cliente@empresa.com"
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Notas internas (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: vendida con el curso, factura #123"
            className={field}
          />
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          Crear y analizar
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function AuditDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminUiFetch(`/api/admin-ui/agentic-audits/${id}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Error ${res.status}`);
      const data = (await res.json()) as { item: AuditDetail };
      setAudit(data.item);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll mientras está corriendo.
  useEffect(() => {
    if (!audit || (audit.status !== 'running' && audit.status !== 'pending')) return;
    const t = setTimeout(() => void load(), 4000);
    return () => clearTimeout(t);
  }, [audit, load]);

  async function patch(body: Record<string, unknown>) {
    setActing(true);
    try {
      const res = await adminUiFetch(`/api/admin-ui/agentic-audits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as { item: AuditDetail };
        setAudit((prev) => (prev ? { ...prev, ...data.item } : data.item));
      }
    } finally {
      setActing(false);
    }
  }

  async function rerun() {
    setActing(true);
    try {
      await adminUiFetch(`/api/admin-ui/agentic-audits/${id}/run`, { method: 'POST' });
      setAudit((prev) => (prev ? { ...prev, status: 'running' } : prev));
      setTimeout(() => void load(), 3000);
    } finally {
      setActing(false);
    }
  }

  async function remove() {
    if (!confirm('¿Eliminar esta auditoría? No se puede deshacer.')) return;
    await adminUiFetch(`/api/admin-ui/agentic-audits/${id}`, { method: 'DELETE' });
    onBack();
  }

  function copyLink() {
    if (!audit) return;
    void navigator.clipboard.writeText(publicLink(audit.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (loading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }
  if (err || !audit) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{err || 'No encontrada'}</div>
      </div>
    );
  }

  const link = publicLink(audit.slug);
  const isRunning = audit.status === 'running' || audit.status === 'pending';

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900">
        <ArrowLeft className="h-4 w-4" /> Volver a la lista
      </button>

      {/* Cabecera + acciones */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{audit.siteLabel || audit.targetUrl}</h1>
            <a
              href={audit.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-violet-700"
            >
              {audit.targetUrl} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {audit.clientEmail && <p className="mt-1 text-xs text-slate-400">Cliente: {audit.clientEmail}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={rerun}
              disabled={acting || isRunning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} /> Re-analizar
            </button>
            <button
              onClick={remove}
              disabled={acting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        </div>

        {/* Link para el cliente */}
        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Link para el cliente</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-700">
              {link}
            </code>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver
            </a>
          </div>
        </div>

        {/* Venta única */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => patch({ paid: !audit.paidAt })}
            disabled={acting}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:opacity-50 ${
              audit.paidAt
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {audit.paidAt ? 'Pagada ✓' : 'Marcar pagada'}
          </button>
          <button
            onClick={() => patch({ delivered: !audit.deliveredAt })}
            disabled={acting}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:opacity-50 ${
              audit.deliveredAt
                ? 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {audit.deliveredAt ? 'Entregada ✓' : 'Marcar entregada'}
          </button>
        </div>
      </div>

      {/* Estado / resultado */}
      {isRunning ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-10 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-sky-500" />
          <p className="mt-3 text-sm font-semibold text-sky-800">Analizando el sitio…</p>
          <p className="mt-1 text-xs text-sky-600">Esto tarda ~30-60 segundos. La página se actualiza sola.</p>
        </div>
      ) : audit.status === 'failed' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <p className="font-semibold text-rose-900">El análisis falló</p>
          <p className="mt-1 text-sm text-rose-700">{audit.error || 'Error desconocido'}</p>
          <button
            onClick={rerun}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </div>
      ) : audit.resultJson ? (
        <AgenticAuditReport result={audit.resultJson} />
      ) : null}
    </div>
  );
}
