'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, Search } from 'lucide-react';
import { internalReportsApi, type AdminPaymentsReport } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_process', label: 'En proceso' },
  { value: 'rejected', label: 'Rechazada' },
  { value: 'refunded', label: 'Reembolsada' },
  { value: 'cancelled', label: 'Cancelada' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  approved: 'Aprobada',
  pending: 'Pendiente',
  in_process: 'En proceso',
  rejected: 'Rechazada',
  refunded: 'Reembolsada',
  cancelled: 'Cancelada',
};

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  in_process: 'bg-sky-50 text-sky-700 ring-sky-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  refunded: 'bg-slate-100 text-slate-700 ring-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
};

function statusBadgeClass(status: string): string {
  return STATUS_BADGE[status] || 'bg-slate-100 text-slate-600 ring-slate-200';
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] || status;
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function AdminFacturasPage() {
  const [data, setData] = useState<AdminPaymentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    internalReportsApi
      .payments({ status: statusFilter, search, page, pageSize })
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Error cargando facturas';
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, search, page]);

  const onSubmitSearch = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const summary = data?.summary;
  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const approvedThisMonth = summary?.approvedThisMonth;
  const approvedAllTime = summary?.approvedAllTime;

  const byStatusEntries = useMemo(() => {
    if (!summary?.byStatus) return [];
    return Object.entries(summary.byStatus).sort(([, a], [, b]) => b - a);
  }, [summary]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Facturas emitidas</h1>
            <p className="text-sm text-slate-600">
              Todos los cobros procesados a clientes por Mercado Pago (planes y upgrades).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refrescar
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cobrado este mes</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {formatMoney(approvedThisMonth?.totalArs ?? 0, 'ARS')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {approvedThisMonth?.count ?? 0} pagos aprobados
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cobrado total</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {formatMoney(approvedAllTime?.totalArs ?? 0, 'ARS')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {approvedAllTime?.count ?? 0} pagos aprobados (histórico)
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Neto recibido</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {formatMoney(approvedAllTime?.netReceivedArs ?? 0, 'ARS')}
          </p>
          <p className="mt-1 text-xs text-slate-500">Después de comisiones de MP</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Por estado</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {byStatusEntries.length === 0 ? (
              <span className="text-xs text-slate-500">Sin datos</span>
            ) : (
              byStatusEntries.map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusBadgeClass(status)}`}
                >
                  {statusLabel(status)} · {count}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const active = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setStatusFilter(opt.value);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-violet-600 text-white shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <form onSubmit={onSubmitSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(ev) => setSearchInput(ev.target.value)}
                placeholder="Email, tenant o ID de MP…"
                className="rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Buscar
            </button>
          </form>
        </div>

        {error ? (
          <div className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">ID Mercado Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Cargando facturas…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No hay facturas para los filtros actuales.
                  </td>
                </tr>
              ) : (
                items.map((p) => {
                  const planName =
                    p.subscription?.planName || p.tenant?.planName || '—';
                  const tenantLabel = p.tenant?.tenantCode || '—';
                  const monto = p.amountArs ?? p.amountUsd;
                  const monedaMonto = p.amountArs != null ? 'ARS' : 'USD';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDate(p.paidAt || p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{tenantLabel}</div>
                        <div className="text-xs text-slate-500">{p.payerEmail || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{planName}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold tabular-nums text-slate-900">
                          {formatMoney(monto, monedaMonto)}
                        </div>
                        {p.netReceivedAmountArs != null && p.netReceivedAmountArs !== monto ? (
                          <div className="text-xs text-slate-500">
                            Neto: {formatMoney(p.netReceivedAmountArs, 'ARS')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.paymentMethodId || p.paymentTypeId || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(p.status)}`}
                        >
                          {statusLabel(p.status)}
                        </span>
                        {p.statusDetail ? (
                          <div className="mt-1 text-[11px] text-slate-500">{p.statusDetail}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {p.mpPaymentId || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Mostrando {(pagination.page - 1) * pagination.pageSize + (items.length > 0 ? 1 : 0)}–
              {(pagination.page - 1) * pagination.pageSize + items.length} de {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
