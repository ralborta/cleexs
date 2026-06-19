'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, ExternalLink, Loader2, Search, UserRound } from 'lucide-react';
import { PlanConquistarUpsellTeaser } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import {
  loadPlanConquistarTeaserFromAdminRun,
  type PlanConquistarTeaserPreviewMeta,
} from '@/lib/plan-conquistar-preview';
import type { PlanConquistarTeaserData } from '@/components/diagnostico/plan-conquistar-upsell-teaser';

type RunListItem = {
  id: string;
  status: string;
  createdAt: string;
  brandName: string;
  domain: string | null;
  prompts: number;
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function termFromInput(raw: string): string {
  let term = raw.trim();
  try {
    if (/^https?:\/\//i.test(term)) term = new URL(term).hostname;
  } catch {
    // input no es URL válida
  }
  return term.replace(/^www\./i, '').replace(/\/.*$/, '').trim();
}

export function PlanConquistarUpsellClientPreview() {
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PlanConquistarTeaserData | null>(null);
  const [previewMeta, setPreviewMeta] = useState<PlanConquistarTeaserPreviewMeta | null>(null);

  const loadRuns = useCallback(async (q: string) => {
    setListLoading(true);
    setListError(null);
    setNotice(null);
    try {
      const url = `/api/admin-ui/plan-conquistar/runs${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { items?: RunListItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      setRuns(body.items || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'No se pudo cargar la lista de clientes.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns('');
  }, [loadRuns]);

  const openPreview = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setPreviewMeta(null);
    try {
      const { data, meta } = await loadPlanConquistarTeaserFromAdminRun(runId);
      setPreviewData(data);
      setPreviewMeta(meta);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'No se pudo generar la vista previa.');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  async function searchClient() {
    const raw = manual.trim();
    if (!raw) return;
    setListError(null);
    setNotice(null);

    const uuid = raw.match(UUID_RE);
    if (uuid) {
      await openPreview(uuid[0]);
      return;
    }

    const term = termFromInput(raw);
    if (!term) {
      setListError('Pegá un dominio, marca o runId.');
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/admin-ui/plan-conquistar/runs?q=${encodeURIComponent(term)}`, {
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as { items?: RunListItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      const items = body.items || [];
      if (items.length === 0) {
        setRuns([]);
        setListError(`No hay corridas para "${term}".`);
        return;
      }
      if (items.length === 1) {
        await openPreview(items[0].id);
        return;
      }
      setRuns(items);
      setQuery(term);
      setNotice(`Encontré ${items.length} corridas para "${term}". Elegí cuál previsualizar.`);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'No se pudo buscar.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <Eye className="h-3.5 w-3.5" />
            Vista previa antes de publicar
          </div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Probá cómo lo verá un cliente</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Elegí un cliente o pegá su dominio. Generamos el upsell bloqueado con sus datos reales, igual que al final de{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">/ver-resultado</code>. Solo vos lo ves hasta que actives la promo.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm font-semibold text-slate-900">Buscar cliente</p>
        <p className="mt-0.5 text-xs text-slate-500">Dominio, marca o runId</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="ej: mailberry.com  ·  Nivea  ·  runId"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchClient();
            }}
          />
          <button
            type="button"
            onClick={searchClient}
            disabled={!manual.trim() || searching}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Previsualizar
          </button>
        </div>
        {listError ? <p className="mt-3 text-sm text-rose-600">{listError}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Clientes recientes</p>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadRuns(query.trim());
              }}
              placeholder="Filtrar por marca o dominio"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </div>
        </div>
        {listLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Cargando...
          </div>
        ) : runs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No se encontraron corridas.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => openPreview(run.id)}
                className={`flex w-full items-center justify-between gap-4 py-3 text-left transition hover:bg-slate-50 ${
                  selectedRunId === run.id ? 'bg-violet-50/50' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{run.brandName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {run.domain || 'sin dominio'} · {run.prompts} prompts ·{' '}
                    {new Date(run.createdAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-violet-700">Preview →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRunId ? (
        <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-slate-50/50 p-4 sm:p-6">
          {previewLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              Generando preview con datos del cliente...
            </div>
          ) : previewError ? (
            <p className="py-8 text-center text-sm text-rose-600">{previewError}</p>
          ) : previewData && previewMeta ? (
            <>
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Preview interno · {previewMeta.brandName}
                    </p>
                    <p className="text-xs text-slate-600">
                      {previewMeta.domain || 'sin dominio'} · score {previewData.cleexsScore} ·{' '}
                      {previewData.totalOpportunities} oportunidades
                    </p>
                    <p className="mt-1 text-[11px] text-violet-700">
                      El cliente no ve esto hasta que actives la promo arriba.
                    </p>
                  </div>
                </div>
                {previewMeta.diagnosticId ? (
                  <a
                    href={`/ver-resultado?diagnosticId=${encodeURIComponent(previewMeta.diagnosticId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900"
                  >
                    Abrir su /ver-resultado actual
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              <PlanConquistarUpsellTeaser data={previewData} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
