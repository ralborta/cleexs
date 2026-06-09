'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  Eye,
  Globe,
  Loader2,
  Mail,
  RefreshCw,
  Share2,
  Users,
} from 'lucide-react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

export const dynamic = 'force-dynamic';

type FunnelStep = { count: number; pct: number | null };
type Metrics = {
  range: { from: string; to: string };
  funnel: {
    homeVisitors: { count: number; pageViews: number };
    urlSubmitted: FunnelStep;
    emailLeft: FunnelStep;
    shared: FunnelStep & { byChannel: { channel: string; count: number }[] };
    referred: FunnelStep & { byCode: { refCode: string; count: number }[] };
    purchased: FunnelStep & { bySource: { source: string; count: number; usd: number }[] };
  };
  outreach: {
    emailsSent: number;
    domainsContacted: number;
    domainsReturned: number;
    returnPct: number | null;
  };
};

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function pctLabel(p: number | null) {
  return p == null ? '—' : `${p}%`;
}

function toDayString(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: 'ayer' | '7' | '15' | '30'): { from: string; to: string } {
  const today = new Date();
  const to = new Date(today);
  const from = new Date(today);
  if (preset === 'ayer') {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (preset === '7') {
    from.setDate(from.getDate() - 6);
  } else if (preset === '15') {
    from.setDate(from.getDate() - 14);
  } else {
    from.setDate(from.getDate() - 29);
  }
  return { from: toDayString(from), to: toDayString(to) };
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  linkedin: 'LinkedIn',
  x: 'X',
  copy: 'Copiar link',
  other: 'Otro',
};

export default function AdminConversionPage() {
  const initial = useMemo(() => rangeForPreset('7'), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string | null>('7');
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await adminUiFetch(`/api/admin-ui/conversion${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar métricas');
      setData(json as Metrics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(preset: 'ayer' | '7' | '15' | '30') {
    const r = rangeForPreset(preset);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(preset);
  }

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  const f = data?.funnel;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Métricas de Conversión</h1>
            <p className="text-sm text-slate-600">
              Embudo de adquisición de Cleexs. Elegí el rango de fechas para ver cómo venimos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            ['ayer', 'Ayer'],
            ['7', 'Últimos 7 días'],
            ['15', 'Últimos 15 días'],
            ['30', 'Últimos 30 días'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activePreset === key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Desde
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Hasta
            <input
              type="date"
              value={to}
              min={from}
              max={toDayString(new Date())}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
            />
          </label>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FunnelCard
          icon={<Eye className="h-4 w-4 text-slate-600" />}
          label="Visitantes"
          value={fmt(f?.homeVisitors.count ?? 0)}
          hint={`${fmt(f?.homeVisitors.pageViews ?? 0)} vistas`}
          pct="100%"
        />
        <FunnelCard
          icon={<Globe className="h-4 w-4 text-sky-600" />}
          label="Pusieron URL"
          value={fmt(f?.urlSubmitted.count ?? 0)}
          pct={pctLabel(f?.urlSubmitted.pct ?? null)}
          pctHint="de visitantes"
        />
        <FunnelCard
          icon={<Mail className="h-4 w-4 text-violet-600" />}
          label="Dejaron email"
          value={fmt(f?.emailLeft.count ?? 0)}
          pct={pctLabel(f?.emailLeft.pct ?? null)}
          pctHint="de los que pusieron URL"
        />
        <FunnelCard
          icon={<Share2 className="h-4 w-4 text-amber-600" />}
          label="Compartieron"
          value={fmt(f?.shared.count ?? 0)}
          pct={pctLabel(f?.shared.pct ?? null)}
          pctHint="de los que pusieron URL"
        />
        <FunnelCard
          icon={<Users className="h-4 w-4 text-emerald-600" />}
          label="Referidos"
          value={fmt(f?.referred.count ?? 0)}
          pct={pctLabel(f?.referred.pct ?? null)}
          pctHint="vinieron por un link"
        />
        <FunnelCard
          icon={<DollarSign className="h-4 w-4 text-rose-600" />}
          label="Compraron"
          value={fmt(f?.purchased.count ?? 0)}
          pct={pctLabel(f?.purchased.pct ?? null)}
          pctHint="de los que pusieron URL"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard title="Compartido por canal" empty="Sin compartidos en el rango.">
          {(f?.shared.byChannel ?? []).map((r) => (
            <Row key={r.channel} label={CHANNEL_LABEL[r.channel] ?? r.channel} value={fmt(r.count)} />
          ))}
        </BreakdownCard>

        <BreakdownCard title="Referidos por código" empty="Sin referidos en el rango.">
          {(f?.referred.byCode ?? []).map((r) => (
            <Row key={r.refCode} label={r.refCode} value={fmt(r.count)} />
          ))}
        </BreakdownCard>

        <BreakdownCard title="Compras por origen" empty="Sin compras en el rango.">
          {(f?.purchased.bySource ?? []).map((r) => (
            <Row key={r.source} label={r.source} value={`${fmt(r.count)} · $${fmt(r.usd)}`} />
          ))}
        </BreakdownCard>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Cold outreach a competidores</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniStat label="Emails enviados" value={fmt(data?.outreach.emailsSent ?? 0)} />
          <MiniStat label="Dominios contactados" value={fmt(data?.outreach.domainsContacted ?? 0)} />
          <MiniStat label="Dominios que entraron" value={fmt(data?.outreach.domainsReturned ?? 0)} />
          <MiniStat label="% de retorno" value={pctLabel(data?.outreach.returnPct ?? null)} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          &quot;Dominios que entraron&quot; cruza los dominios a los que les escribimos con los que después
          ingresaron una URL en el diagnóstico (aproximado por coincidencia de dominio).
        </p>
      </section>
    </div>
  );
}

function FunnelCard({
  icon,
  label,
  value,
  pct,
  pctHint,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct: string;
  pctHint?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-sm font-semibold text-emerald-600">{pct}</span>
        {pctHint ? <span className="text-[10px] text-slate-400">{pctHint}</span> : null}
      </div>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function BreakdownCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {hasChildren ? (
        <div className="space-y-1.5">{children}</div>
      ) : (
        <p className="text-xs text-slate-400">{empty}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <span className="truncate text-xs font-medium text-slate-700">{label}</span>
      <span className="shrink-0 text-xs font-bold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-center">
      <p className="text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
