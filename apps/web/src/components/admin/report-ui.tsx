'use client';

import type { LucideIcon } from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import type { ReportWindowDays } from '@/lib/api';

const TONE_CLASSES: Record<string, string> = {
  slate: 'text-slate-600',
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  violet: 'text-violet-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  indigo: 'text-indigo-700',
  rose: 'text-rose-700',
};

export type ReportTone = keyof typeof TONE_CLASSES;

export function ReportMetric({
  label,
  value,
  Icon,
  hint,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  Icon: LucideIcon;
  hint?: string;
  tone?: ReportTone;
}) {
  const toneClass = TONE_CLASSES[tone] || TONE_CLASSES.slate;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${toneClass}`}>{label}</p>
        <Icon className={`h-4 w-4 ${toneClass}`} aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-tight text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ReportSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WindowDaysToggle({
  value,
  onChange,
  options = [7, 30, 90],
  disabled = false,
}: {
  value: ReportWindowDays;
  onChange: (next: ReportWindowDays) => void;
  options?: ReadonlyArray<ReportWindowDays>;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs font-medium">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`rounded-lg px-2.5 py-1 transition ${
            value === opt
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {opt}d
        </button>
      ))}
    </div>
  );
}

export function ReportRefreshButton({
  loading,
  onClick,
  label = 'Refrescar',
}: {
  loading: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
      {label}
    </button>
  );
}

export function ReportErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {message}
    </div>
  );
}

export function ReportLoading({ label = 'Cargando reporte...' }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

export function MiniBars({
  data,
  className = '',
  height = 60,
}: {
  data: Array<{ label: string; value: number; secondary?: number }>;
  className?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)));
  return (
    <div className={`flex items-end gap-0.5 ${className}`} style={{ height }}>
      {data.map((d) => {
        const h = (d.value / max) * height;
        const sh = ((d.secondary ?? 0) / max) * height;
        return (
          <div
            key={d.label}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${d.label}: ${d.value}${d.secondary != null ? ` / ${d.secondary}` : ''}`}
          >
            {d.secondary != null ? (
              <div
                className="w-full rounded-t-sm bg-emerald-500/70"
                style={{ height: Math.max(sh, d.secondary > 0 ? 2 : 0) }}
              />
            ) : null}
            <div
              className="w-full rounded-t-sm bg-violet-500"
              style={{ height: Math.max(h, d.value > 0 ? 2 : 0) }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function formatPercent(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

export function ReferrerNameCell({
  name,
  refCode,
  isSponsor,
}: {
  name: string;
  refCode: string;
  isSponsor?: boolean;
}) {
  return (
    <div>
      <div className="font-medium text-slate-900">
        {name}
        {isSponsor ? (
          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            YouTube
          </span>
        ) : null}
      </div>
      {name !== refCode ? (
        <div className="font-mono text-[10px] text-slate-400">{refCode}</div>
      ) : null}
    </div>
  );
}

export function SponsorBreakdownTable({
  rows,
  empty = 'Sin tráfico de auspiciadores en la ventana.',
}: {
  rows: Array<{
    refCode: string;
    name: string;
    web: { diagnostics: number; withEmail: number };
    whatsapp: { diagnostics: number; withEmail: number };
    total: { diagnostics: number; withEmail: number };
  }>;
  empty?: string;
}) {
  const hasData = rows.some((r) => r.total.diagnostics > 0);
  if (!hasData) return <p className="text-sm text-slate-500">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="py-2">Auspiciador</th>
            <th className="py-2 text-right">Web</th>
            <th className="py-2 text-right">WhatsApp</th>
            <th className="py-2 text-right">Total</th>
            <th className="py-2 text-right">Emails</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.refCode} className="border-t border-slate-100">
              <td className="py-2">
                <ReferrerNameCell name={row.name} refCode={row.refCode} isSponsor />
              </td>
              <td className="py-2 text-right tabular-nums text-slate-900">{row.web.diagnostics}</td>
              <td className="py-2 text-right tabular-nums text-slate-900">{row.whatsapp.diagnostics}</td>
              <td className="py-2 text-right tabular-nums font-medium text-slate-900">
                {row.total.diagnostics}
              </td>
              <td className="py-2 text-right tabular-nums text-emerald-700">{row.total.withEmail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmailFunnelCard({
  icon,
  label,
  value,
  pct,
  pctHint,
  hint,
  onClick,
  actionHint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct?: string | null;
  pctHint?: string;
  hint?: string;
  onClick?: () => void;
  actionHint?: string;
}) {
  const clickable = typeof onClick === 'function';
  const className = `group rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
    clickable
      ? 'border-violet-200 hover:border-violet-300 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-200'
      : 'border-slate-200'
  }`;
  const inner = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <div className="mt-1 min-h-[2.5rem] flex items-baseline gap-1">
        {pct != null && pct !== '—' ? (
          <span className="text-sm font-semibold text-emerald-600">{pct}</span>
        ) : null}
        {pctHint ? <span className="text-[10px] text-slate-400">{pctHint}</span> : null}
      </div>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p> : null}
      {clickable && actionHint ? (
        <p className="mt-1 text-[10px] font-semibold text-violet-600 opacity-80 group-hover:opacity-100">
          {actionHint} →
        </p>
      ) : null}
    </>
  );
  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}
