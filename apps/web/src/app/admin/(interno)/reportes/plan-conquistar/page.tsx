'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Trophy } from 'lucide-react';
import { PlanConquistarReportView } from '@/components/reportes/plan-conquistar-report-view';

type RunListItem = {
  id: string;
  status: string;
  runType?: string | null;
  createdAt: string;
  brandName: string;
  domain: string | null;
  prompts: number;
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'emerald' | 'amber' }) {
  const classes: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>
      {children}
    </span>
  );
}

export default function AdminPlanConquistarPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (selectedRunId) {
    return (
      <PlanConquistarReportView
        runId={selectedRunId}
        variant="admin"
        onBack={() => setSelectedRunId(null)}
      />
    );
  }
  return <RunPicker onSelect={setSelectedRunId} />;
}

function RunPicker({ onSelect }: { onSelect: (runId: string) => void }) {
  const [query, setQuery] = useState('');
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [opening, setOpening] = useState(false);

  const loadRuns = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const url = `/api/admin-ui/plan-conquistar/runs${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { items?: RunListItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      setRuns(body.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de corridas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns('');
  }, [loadRuns]);

  function termFromInput(raw: string): string {
    let term = raw.trim();
    try {
      if (/^https?:\/\//i.test(term)) term = new URL(term).hostname;
    } catch {
      // input no es URL válida; lo usamos tal cual como término de búsqueda
    }
    return term.replace(/^www\./i, '').replace(/\/.*$/, '').trim();
  }

  async function openManual() {
    const raw = manual.trim();
    if (!raw) return;
    setError(null);
    setNotice(null);

    const uuid = raw.match(UUID_RE);
    if (uuid) {
      onSelect(uuid[0]);
      return;
    }

    const term = termFromInput(raw);
    if (!term) {
      setError('Pegá un runId, un dominio o el nombre de una marca.');
      return;
    }

    setOpening(true);
    try {
      const res = await fetch(`/api/admin-ui/plan-conquistar/runs?q=${encodeURIComponent(term)}`, {
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as { items?: RunListItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      const items = body.items || [];
      if (items.length === 0) {
        setRuns([]);
        setError(`No hay corridas para "${term}". Probá con otro dominio o buscá un cliente.`);
        return;
      }
      if (items.length === 1) {
        onSelect(items[0].id);
        return;
      }
      setRuns(items);
      setQuery(term);
      setNotice(`Encontré ${items.length} corridas para "${term}". Elegí cuál abrir abajo.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar por ese dominio.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
          <Trophy className="h-4 w-4" />
          AI Visibility Accelerator · Plan Conquistar
        </div>
        <h1 className="mt-3 text-2xl font-bold">Generá el informe completo desde admin</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-violet-50">
          Elegí una corrida de un cliente para abrir su entregable completo, o pegá un runId / URL para probar el reporte.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Probar con un dominio, runId o URL</p>
        <p className="mt-1 text-xs text-slate-500">
          Pegá un dominio (ej: nivea.com.ar), el nombre de una marca, un runId o una URL. Busco la corrida del cliente y abro el reporte.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="nivea.com.ar  ·  marca  ·  runId  ·  URL"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter') openManual();
            }}
          />
          <button
            type="button"
            onClick={openManual}
            disabled={!manual.trim() || opening}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Abrir reporte
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Corridas recientes</p>
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
        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Cargando corridas...
          </div>
        ) : runs.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No se encontraron corridas.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelect(run.id)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{run.brandName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {run.domain || 'sin dominio'} · {run.prompts} prompts · {new Date(run.createdAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={run.status === 'completed' ? 'emerald' : 'amber'}>{run.status}</Badge>
                  <span className="text-xs font-semibold text-violet-700">Abrir →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
