'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sponsorToolsApi, type PlatformDashboard } from '@/lib/api';
import { normalizeTrackingValue } from '@/lib/sponsor-link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, Loader2, MessageCircle, RefreshCw, TrendingUp } from 'lucide-react';

type ReferralRow = PlatformDashboard['referrals']['topReferrers'][number];
type WaReferralRow = PlatformDashboard['whatsappReferrals']['topReferrers'][number];

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

function ReferralStats({
  activeRow,
  normalizedActiveRef,
  channelLabel,
}: {
  activeRow?: { visits: number; completedDiagnostics: number; completionRate: number; capturedEmails: number; latestAt: string };
  normalizedActiveRef?: string;
  channelLabel: string;
}) {
  if (!normalizedActiveRef) return null;
  return (
    <div
      className={`mt-5 rounded-xl border px-4 py-4 ${
        activeRow ? 'border-primary-200 bg-primary-50/60' : 'border-dashed border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {channelLabel} · ref <span className="text-slate-800">{normalizedActiveRef}</span>
      </p>
      {activeRow ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Inicios" value={String(activeRow.visits)} />
            <Stat label="Completados" value={String(activeRow.completedDiagnostics)} />
            <Stat label="% cierre" value={`${activeRow.completionRate.toFixed(1)}%`} />
            <Stat label="Emails" value={String(activeRow.capturedEmails)} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Último: {formatDate(activeRow.latestAt)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Aún no hay diagnósticos con este <code className="text-xs">ref</code> en este canal.
        </p>
      )}
    </div>
  );
}

function ReferralTable({
  rows,
  normalizedActiveRef,
  showTopSource,
}: {
  rows: Array<{
    refCode: string;
    visits: number;
    completedDiagnostics: number;
    completionRate: number;
    capturedEmails: number;
    topSource?: string;
  }>;
  normalizedActiveRef?: string;
  showTopSource?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">Sin tráfico registrado todavía.</p>;
  }
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-100">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold text-slate-600">Ref</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Inicios</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Completados</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">% cierre</TableHead>
            <TableHead className="hidden text-right font-semibold text-slate-600 sm:table-cell">Emails</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 15).map((row) => {
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
  );
}

export function SponsorTrackingPanel({ activeRef }: { activeRef: string }) {
  const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedActiveRef = useMemo(() => normalizeTrackingValue(activeRef), [activeRef]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sponsorToolsApi.getMetrics();
      setDashboard(data);
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : 'No pudimos cargar las métricas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const webData = dashboard?.referrals;
  const waData = dashboard?.whatsappReferrals ?? { totalDiagnostics: 0, topReferrers: [] };

  const activeWebRow: ReferralRow | undefined = useMemo(() => {
    if (!webData || !normalizedActiveRef) return undefined;
    return webData.topReferrers.find((r) => r.refCode === normalizedActiveRef);
  }, [webData, normalizedActiveRef]);

  const activeWaRow: WaReferralRow | undefined = useMemo(() => {
    if (!waData || !normalizedActiveRef) return undefined;
    return waData.topReferrers.find((r) => r.refCode === normalizedActiveRef);
  }, [waData, normalizedActiveRef]);

  const sortedWebRows = useMemo(() => {
    if (!webData) return [];
    const rows = [...webData.topReferrers];
    if (!normalizedActiveRef) return rows;
    return rows.sort((a, b) => {
      if (a.refCode === normalizedActiveRef) return -1;
      if (b.refCode === normalizedActiveRef) return 1;
      return b.visits - a.visits;
    });
  }, [webData, normalizedActiveRef]);

  const sortedWaRows = useMemo(() => {
    if (!waData) return [];
    const rows = [...waData.topReferrers];
    if (!normalizedActiveRef) return rows;
    return rows.sort((a, b) => {
      if (a.refCode === normalizedActiveRef) return -1;
      if (b.refCode === normalizedActiveRef) return 1;
      return b.visits - a.visits;
    });
  }, [waData, normalizedActiveRef]);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-600" aria-hidden />
            <h2 className="text-lg font-bold text-slate-900">Seguimiento</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Métricas por código <code className="rounded bg-slate-100 px-1 text-xs">ref</code> (link web y QR WhatsApp).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {loading && !dashboard && (
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

      {dashboard && (
        <Tabs defaultValue="web" className="mt-5">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="web">Link web</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="web" className="mt-4">
            <p className="text-sm text-slate-600">
              Diagnósticos con ref/UTM desde{' '}
              <span className="font-medium text-slate-800">cleexs.net</span> o la app.
              {webData != null && (
                <span className="ml-1 font-medium">{webData.totalTrackedDiagnostics} con tracking en total.</span>
              )}
            </p>
            <ReferralStats
              activeRow={activeWebRow}
              normalizedActiveRef={normalizedActiveRef}
              channelLabel="Web"
            />
            <ReferralTable rows={sortedWebRows} normalizedActiveRef={normalizedActiveRef} />
            {webData && webData.topSources.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fuentes UTM</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {webData.topSources.slice(0, 8).map((row) => (
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
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4">
            <p className="text-sm text-slate-600">
              Diagnósticos iniciados por canal WhatsApp (QR con <code className="text-xs">ref:</code> en el mensaje).
              {waData != null && (
                <span className="ml-1 font-medium">{waData.totalDiagnostics} en total.</span>
              )}
            </p>
            <ReferralStats
              activeRow={activeWaRow}
              normalizedActiveRef={normalizedActiveRef}
              channelLabel="WhatsApp"
            />
            <ReferralTable rows={sortedWaRows} normalizedActiveRef={normalizedActiveRef} />
          </TabsContent>
        </Tabs>
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
