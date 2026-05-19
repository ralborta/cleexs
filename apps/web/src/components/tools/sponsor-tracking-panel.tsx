'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { reportsApi, type PlatformDashboard } from '@/lib/api';
import { normalizeTrackingValue } from '@/lib/sponsor-link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';

type ReferralRow = PlatformDashboard['referrals']['topReferrers'][number];

function formatDate(iso: string) {
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

export function SponsorTrackingPanel({ activeRef }: { activeRef: string }) {
  const [data, setData] = useState<PlatformDashboard['referrals'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedActiveRef = useMemo(() => normalizeTrackingValue(activeRef), [activeRef]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await reportsApi.getPlatformDashboard();
      setData(dashboard.referrals);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'No pudimos cargar las métricas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRow: ReferralRow | undefined = useMemo(() => {
    if (!data || !normalizedActiveRef) return undefined;
    return data.topReferrers.find((r) => r.refCode === normalizedActiveRef);
  }, [data, normalizedActiveRef]);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.topReferrers];
    if (!normalizedActiveRef) return rows;
    return rows.sort((a, b) => {
      if (a.refCode === normalizedActiveRef) return -1;
      if (b.refCode === normalizedActiveRef) return 1;
      return b.visits - a.visits;
    });
  }, [data, normalizedActiveRef]);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-600" aria-hidden />
            <h2 className="text-lg font-bold text-slate-900">Seguimiento</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Diagnósticos con <code className="rounded bg-slate-100 px-1 text-xs">ref</code> o UTM registrados.
            {data != null && (
              <span className="ml-1 font-medium text-slate-800">{data.totalTrackedDiagnostics} en total.</span>
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {loading && !data && (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando métricas…
        </p>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {data && normalizedActiveRef && (
        <div
          className={`mt-5 rounded-xl border px-4 py-4 ${
            activeRow
              ? 'border-primary-200 bg-primary-50/60'
              : 'border-dashed border-slate-200 bg-slate-50'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Código activo: <span className="text-slate-800">{normalizedActiveRef}</span>
          </p>
          {activeRow ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Visitas" value={String(activeRow.visits)} />
              <Stat label="Completados" value={String(activeRow.completedDiagnostics)} />
              <Stat label="% cierre" value={`${activeRow.completionRate.toFixed(1)}%`} />
              <Stat label="Emails" value={String(activeRow.capturedEmails)} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Aún no hay diagnósticos con este <code className="text-xs">ref</code>. Cuando alguien entre con el link
              generado arriba, los números aparecerán acá.
            </p>
          )}
          {activeRow && (
            <p className="mt-2 text-[11px] text-slate-500">
              Última visita: {formatDate(activeRow.latestAt)} · utm_source más frecuente:{' '}
              <span className="font-medium text-slate-700">{activeRow.topSource}</span>
            </p>
          )}
        </div>
      )}

      {data && data.topReferrers.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-600">Ref</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Visitas</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Completados</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">% cierre</TableHead>
                <TableHead className="hidden text-right font-semibold text-slate-600 sm:table-cell">Emails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.slice(0, 15).map((row) => {
                const highlighted = normalizedActiveRef && row.refCode === normalizedActiveRef;
                return (
                  <TableRow key={row.refCode} className={highlighted ? 'bg-primary-50/50' : undefined}>
                    <TableCell className="font-medium text-slate-900">{row.refCode}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">{row.visits}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">{row.completedDiagnostics}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">
                      {row.completionRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-slate-700 sm:table-cell">
                      {row.capturedEmails}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.topSources.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fuentes UTM (utm_source)</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.topSources.slice(0, 8).map((row) => (
              <li
                key={row.source}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
              >
                <span className="font-medium">{row.source}</span>
                <span className="ml-1.5 tabular-nums text-slate-500">{row.visits}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.topReferrers.length === 0 && !loading && (
        <p className="mt-4 text-sm text-slate-500">Todavía no hay códigos ref con tráfico. Compartí un link y actualizá.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
