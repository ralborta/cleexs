'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Award, Building2, Calendar, CheckCircle2, Search, Tag } from 'lucide-react';
import { internalReportsApi, type BrandsOverviewItem, type BrandsOverviewReport } from '@/lib/api';
import {
  ReportErrorBanner,
  ReportLoading,
  ReportMetric,
  ReportRefreshButton,
  ReportSection,
  formatDate,
} from '@/components/admin/report-ui';

const PAGE_SIZE = 15;

function scoreBadge(score: number | null): string {
  if (score == null) return 'bg-slate-100 text-slate-500 ring-1 ring-slate-200';
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
  if (score >= 60) return 'bg-sky-100 text-sky-800 ring-1 ring-sky-200';
  if (score >= 40) return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  if (score >= 20) return 'bg-orange-100 text-orange-800 ring-1 ring-orange-200';
  return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200';
}

const RUN_STATUS_BADGES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  running: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  failed: 'bg-red-100 text-red-800 ring-1 ring-red-200',
};

function isPremiumPlan(plan: string | null | undefined): boolean {
  return Boolean(plan && plan.toLowerCase().includes('premium'));
}

export default function AdminMarcasPage() {
  const [data, setData] = useState<BrandsOverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await internalReportsApi.brands({
        search: debouncedSearch || undefined,
        limit: 500,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar marcas analizadas.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const items: BrandsOverviewItem[] = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = useMemo(() => items.slice(start, start + PAGE_SIZE), [items, start]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Marcas analizadas</h1>
            <p className="text-sm text-slate-600">
              Todas las marcas que pasaron por Cleexs con su Cleexs Score, dueño y estado.
            </p>
          </div>
        </div>
        <ReportRefreshButton loading={loading} onClick={load} />
      </header>

      {error ? <ReportErrorBanner message={error} /> : null}

      {data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ReportMetric label="Marcas totales" value={data.summary.total} Icon={Building2} tone="sky" />
          <ReportMetric
            label="Con Cleexs Score"
            value={data.summary.withScore}
            Icon={Award}
            tone="violet"
            hint={`promedio ${data.summary.scoredAvg.toFixed(1)}/100`}
          />
          <ReportMetric
            label="Cuentas Premium"
            value={data.summary.premium}
            Icon={CheckCircle2}
            tone="emerald"
          />
          <ReportMetric
            label="Con al menos 1 run"
            value={data.summary.withRuns}
            Icon={Calendar}
            tone="amber"
          />
        </div>
      ) : null}

      <ReportSection
        title="Listado completo"
        description="Buscá por marca, dominio, industria, plan o código de tenant."
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
        }
      >
        {loading && !data ? <ReportLoading /> : null}

        {data ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Marca</th>
                    <th className="py-2">Industria</th>
                    <th className="py-2 text-right">Score</th>
                    <th className="py-2 text-right">Runs</th>
                    <th className="py-2">Ultimo run</th>
                    <th className="py-2">Owner</th>
                    <th className="py-2">Plan</th>
                    <th className="py-2">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
                        {debouncedSearch
                          ? `Sin resultados para "${debouncedSearch}".`
                          : 'Todavia no hay marcas registradas.'}
                      </td>
                    </tr>
                  ) : (
                    visible.map((b) => (
                      <tr key={b.id} className="border-t border-slate-100 align-top">
                        <td className="py-2">
                          <div className="font-medium text-slate-900">{b.name}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            {b.domain ? (
                              <a
                                href={`https://${b.domain.replace(/^https?:\/\//, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-violet-700"
                              >
                                {b.domain}
                              </a>
                            ) : (
                              <span className="italic text-slate-400">sin dominio</span>
                            )}
                            {b.country ? <span className="text-slate-300">·</span> : null}
                            {b.country ? <span>{b.country}</span> : null}
                          </div>
                        </td>
                        <td className="py-2 text-xs text-slate-600">
                          {b.industry || <span className="italic text-slate-400">—</span>}
                          {b.category ? (
                            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                              <Tag className="h-3 w-3" />
                              {b.category}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadge(b.lastScore)}`}>
                            {b.lastScore != null ? b.lastScore.toFixed(1) : 's/d'}
                          </span>
                          {b.lastScoreAt ? (
                            <div className="mt-0.5 text-[10px] text-slate-400">{formatDate(b.lastScoreAt)}</div>
                          ) : null}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{b.runsTotal}</td>
                        <td className="py-2 text-xs">
                          {b.lastRun ? (
                            <>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  RUN_STATUS_BADGES[b.lastRun.status] || RUN_STATUS_BADGES.pending
                                }`}
                              >
                                {b.lastRun.status}
                              </span>
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                {formatDate(b.lastRun.createdAt)}
                              </div>
                            </>
                          ) : (
                            <span className="italic text-slate-400">sin runs</span>
                          )}
                        </td>
                        <td className="py-2 text-xs">
                          {b.tenant ? (
                            <>
                              <div className="font-mono text-[11px] text-slate-700">{b.tenant.code}</div>
                              <div className="text-[10px] text-slate-400">{b.tenant.type}</div>
                            </>
                          ) : (
                            <span className="italic text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 text-xs">
                          {b.tenant?.plan ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isPremiumPlan(b.tenant.plan)
                                  ? 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'
                                  : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                              }`}
                            >
                              {b.tenant.plan}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 text-xs text-slate-500">{formatDate(b.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {items.length > PAGE_SIZE ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-slate-500">
                  Mostrando {start + 1}–{Math.min(start + PAGE_SIZE, items.length)} de {items.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="text-xs font-medium text-slate-600">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </ReportSection>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Para ver runs individuales por marca ir a{' '}
        <Link href="/admin/runs" className="font-medium text-violet-700 hover:text-violet-900">
          /admin/runs
        </Link>{' '}
        o al{' '}
        <Link href="/admin/dashboard" className="font-medium text-violet-700 hover:text-violet-900">
          dashboard global
        </Link>
        .
      </div>
    </div>
  );
}
