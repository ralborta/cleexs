'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  DollarSign,
  Eye,
  Globe,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { DiagnosticReportLink, SponsorBreakdownTable } from '@/components/admin/report-ui';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { internalReportsApi } from '@/lib/api';
import { addDaysToDayString, argentinaDayEndUtc, argentinaDayStartUtc, formatDayInArgentina, INFORME_DIAGNOSTICO_V225_UNLOCK_LINKS } from '@cleexs/shared';

export const dynamic = 'force-dynamic';

type LandingKey = 'all' | 'home' | 'meta-v1';

const LANDING_OPTIONS: Array<{ key: LandingKey; label: string; sub: string }> = [
  { key: 'all', label: 'Todas', sub: 'Home + landings' },
  { key: 'home', label: 'Home', sub: 'cleexs.net/' },
  { key: 'meta-v1', label: 'Meta', sub: '/meta · meta-v1' },
];

type FunnelStep = { count: number; pct: number | null };
type EmailLeftStep = FunnelStep & { pctOfVisitors: number | null };
type Metrics = {
  range: { from: string; to: string };
  landing?: { key: LandingKey; label: string; sub: string };
  funnel: {
    homeVisitors: { count: number; pageViews: number; source?: string };
    urlSubmitted: FunnelStep;
    emailLeft: EmailLeftStep;
    shared: FunnelStep & { byChannel: { channel: string; count: number }[] };
    referred: FunnelStep & {
      byCode: Array<{
        refCode: string;
        name: string;
        count: number;
        isSponsor?: boolean;
        registered?: boolean;
      }>;
    };
    unlockClicks: FunnelStep;
    purchased: FunnelStep & {
      checkoutAttempts: number;
      bySource: { source: string; count: number; usd: number }[];
    };
  };
  outreach: {
    emailsSent: number;
    domainsContacted: number;
    domainsReturned: number;
    returnPct: number | null;
  };
  emailsByReferrer?: Array<{
    refCode: string;
    name: string;
    uniqueEmails: number;
    diagnosticsWithEmail: number;
    registered: boolean;
    isSponsor?: boolean;
  }>;
  sponsorBreakdown?: Array<{
    refCode: string;
    name: string;
    web: { diagnostics: number; withEmail: number };
    whatsapp: { diagnostics: number; withEmail: number };
    total: { diagnostics: number; withEmail: number };
  }>;
};

type UnlockClickBreakdown = {
  unlockKey: string;
  label: string;
  count: number;
  order?: number;
};

type UnlockClickDomainRow = {
  domain: string;
  brandName: string | null;
  clicks: number;
  lastClickAt: string;
};

type UnlockClickClientRow = {
  diagnosticId: string | null;
  brandName: string | null;
  domain: string | null;
  email: string | null;
  unlockKey: string;
  ctaLabel: string;
  clickedAt: string;
};

type UnlockClicksResponse = {
  ok: boolean;
  total: number;
  totalClicks?: number;
  uniqueVisitors?: number;
  uniqueDomains?: number;
  links?: UnlockClickBreakdown[];
  domains?: UnlockClickDomainRow[];
  clientClicks?: UnlockClickClientRow[];
  items: UnlockClickBreakdown[];
};

type EmailLead = {
  id: string;
  email: string | null;
  brandName: string | null;
  domain: string | null;
  industry: string | null;
  sourceChannel: string | null;
  refCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  tier: string | null;
  status: string | null;
  shareSlug: string | null;
  createdAt: string;
};

type EmailLeadsResponse = {
  ok: boolean;
  total: number;
  items: EmailLead[];
};

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function fmtDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pctLabel(p: number | null) {
  return p == null ? '—' : `${p}%`;
}

function CheckoutAttemptsHint({ count }: { count: number }) {
  const numberClass =
    count > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600';
  if (count === 1) {
    return (
      <>
        <span className={numberClass}>1</span> pendiente en MP
      </>
    );
  }
  return (
    <>
      <span className={numberClass}>{fmt(count)}</span> pendientes en MP
    </>
  );
}

async function countPendingMpInRange(fromDay: string, toDay: string): Promise<number> {
  const fromMs = argentinaDayStartUtc(fromDay).getTime();
  const toMs = argentinaDayEndUtc(toDay).getTime();
  const inRange = (createdAt: string) => {
    const t = new Date(createdAt).getTime();
    return t >= fromMs && t <= toMs;
  };

  const first = await internalReportsApi.payments({ status: 'pending', pageSize: 100, page: 1 });
  let items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const next = await internalReportsApi.payments({ status: 'pending', pageSize: 100, page });
    items = items.concat(next.items);
  }
  return items.filter((p) => inRange(p.createdAt)).length;
}

function rangeForPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30'): { from: string; to: string } {
  const today = formatDayInArgentina();
  if (preset === 'hoy') {
    return { from: today, to: today };
  }
  if (preset === 'ayer') {
    const yesterday = addDaysToDayString(today, -1);
    return { from: yesterday, to: yesterday };
  }
  const span = preset === '7' ? 6 : preset === '15' ? 14 : 29;
  return { from: addDaysToDayString(today, -span), to: today };
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  meta: 'Meta',
  linkedin: 'LinkedIn', // share social (distinto de ads Meta / utm_source=meta)
  x: 'X',
  copy: 'Copiar link',
  other: 'Otro',
};

export default function AdminConversionPage() {
  const initial = useMemo(() => rangeForPreset('15'), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string | null>('15');
  /** Default "Todas" = embudo histórico sin alterar números. */
  const [landing, setLanding] = useState<LandingKey>('all');
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailLeads, setEmailLeads] = useState<EmailLead[] | null>(null);
  const [emailLeadsLoading, setEmailLeadsLoading] = useState(false);
  const [emailLeadsError, setEmailLeadsError] = useState<string | null>(null);

  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockDetail, setUnlockDetail] = useState<UnlockClicksResponse | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const openEmailDetail = useCallback(async () => {
    setEmailModalOpen(true);
    setEmailLeadsLoading(true);
    setEmailLeadsError(null);
    try {
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&landing=${encodeURIComponent(landing)}`;
      const res = await adminUiFetch(`/api/admin-ui/conversion/emails${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar el detalle');
      const payload = json as EmailLeadsResponse;
      const items = payload.items ?? [];
      setEmailLeads(items);
      // La tarjeta y el modal deben mostrar el mismo número (evita desfasaje por cache/carga vieja).
      const count = typeof payload.total === 'number' ? payload.total : items.length;
      setData((prev) => {
        if (!prev) return prev;
        const url = prev.funnel.urlSubmitted.count;
        const visitors = prev.funnel.homeVisitors.count;
        const pct = (num: number, den: number): number | null =>
          den > 0 ? Math.round((num / den) * 1000) / 10 : null;
        return {
          ...prev,
          funnel: {
            ...prev.funnel,
            emailLeft: {
              count,
              pct: pct(count, url),
              pctOfVisitors: pct(count, visitors),
            },
          },
        };
      });
    } catch (e) {
      setEmailLeadsError(e instanceof Error ? e.message : 'Error');
    } finally {
      setEmailLeadsLoading(false);
    }
  }, [from, to, landing]);

  const openUnlockDetail = useCallback(async () => {
    setUnlockModalOpen(true);
    setUnlockLoading(true);
    setUnlockError(null);
    try {
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&landing=${encodeURIComponent(landing)}`;
      const res = await adminUiFetch(`/api/admin-ui/conversion/unlock-clicks${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar el detalle');
      setUnlockDetail(json as UnlockClicksResponse);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'Error');
    } finally {
      setUnlockLoading(false);
    }
  }, [from, to, landing]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&landing=${encodeURIComponent(landing)}`;
      const [res, pendingMp] = await Promise.all([
        adminUiFetch(`/api/admin-ui/conversion${qs}`),
        countPendingMpInRange(from, to),
      ]);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar métricas');
      const metrics = json as Metrics;
      metrics.funnel.purchased = {
        ...metrics.funnel.purchased,
        checkoutAttempts: pendingMp,
      };
      setData(metrics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to, landing]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30') {
    const r = rangeForPreset(preset);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(preset);
  }

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  const f = data?.funnel;
  const activeLanding =
    LANDING_OPTIONS.find((o) => o.key === landing) ?? LANDING_OPTIONS[0];
  const visitorsHint =
    landing === 'meta-v1'
      ? 'vistas · /meta'
      : landing === 'home'
        ? 'vistas · home'
        : 'vistas · cleexs.net';

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
              Embudo de adquisición de Cleexs. Por defecto ves Todas (mismo embudo de siempre).
              Filtrá por Home o Meta cuando quieras. Los días cierran a medianoche hora Argentina.
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Landing
        </p>
        <div className="flex flex-wrap gap-2">
          {LANDING_OPTIONS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLanding(l.key)}
              className={`rounded-xl px-3.5 py-2 text-left transition ${
                landing === l.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="block text-sm font-semibold">{l.label}</span>
              <span
                className={`block text-[11px] ${
                  landing === l.key ? 'text-emerald-100' : 'text-slate-500'
                }`}
              >
                {l.sub}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Activo:{' '}
          <span className="font-medium text-slate-800">{activeLanding.label}</span>
          {landing === 'all'
            ? ' — embudo global (números históricos)'
            : landing === 'meta-v1'
              ? ' — reiniciada: solo cuenta tráfico nuevo (histórico ignorado)'
              : ' — visitantes home · sin landings de ads'}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            ['hoy', 'Hoy'],
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
              max={formatDayInArgentina()}
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <FunnelCard
          icon={<Eye className="h-4 w-4 text-slate-600" />}
          label="Visitantes"
          value={fmt(f?.homeVisitors.count ?? 0)}
          hint={`${fmt(f?.homeVisitors.pageViews ?? 0)} ${visitorsHint}`}
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
          pctLines={[
            { pct: f?.emailLeft.pct ?? null, label: 'de URL' },
            { pct: f?.emailLeft.pctOfVisitors ?? null, label: 'de visitas' },
          ]}
          onClick={openEmailDetail}
          actionHint="Ver detalle"
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
          icon={<Lock className="h-4 w-4 text-violet-600" />}
          label="Clics Plan Conquistar"
          value={fmt(f?.unlockClicks.count ?? 0)}
          pct={pctLabel(f?.unlockClicks.pct ?? null)}
          pctHint="de los que dejaron email"
          onClick={openUnlockDetail}
          actionHint="Ver detalle"
        />
        <FunnelCard
          icon={<DollarSign className="h-4 w-4 text-rose-600" />}
          label="Compraron"
          value={fmt(f?.purchased.count ?? 0)}
          pct={pctLabel(f?.purchased.pct ?? null)}
          pctHint="de los que pusieron URL"
          hint={<CheckoutAttemptsHint count={f?.purchased.checkoutAttempts ?? 0} />}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Emails por auspiciador (ranking)" empty="Sin emails atribuidos a un ref en el rango.">
          {(data?.emailsByReferrer ?? [])
            .filter((r) => r.refCode !== '__sin_referidor__')
            .map((r) => (
              <Row
                key={r.refCode}
                label={
                  r.isSponsor
                    ? `${r.name} · YouTube`
                    : r.registered
                      ? r.name
                      : `${r.name} (${r.refCode})`
                }
                value={`${fmt(r.uniqueEmails)} únicos`}
              />
            ))}
        </BreakdownCard>

        <BreakdownCard title="Sin referidor en el rango" empty="En este período todo el tráfico tuvo ref.">
          {(data?.emailsByReferrer ?? [])
            .filter((r) => r.refCode === '__sin_referidor__')
            .map((r) => (
              <Row key={r.refCode} label={r.name} value={`${fmt(r.uniqueEmails)} únicos`} />
            ))}
        </BreakdownCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard title="Compartido por canal" empty="Sin compartidos en el rango.">
          {(f?.shared.byChannel ?? []).map((r) => (
            <Row key={r.channel} label={CHANNEL_LABEL[r.channel] ?? r.channel} value={fmt(r.count)} />
          ))}
        </BreakdownCard>

        <BreakdownCard title="Referidos por código" empty="Sin referidos en el rango.">
          {(f?.referred.byCode ?? []).map((r) => (
            <Row
              key={r.refCode}
              label={r.name !== r.refCode ? `${r.name} (${r.refCode})` : r.name}
              value={fmt(r.count)}
            />
          ))}
        </BreakdownCard>

        <BreakdownCard title="Compras por origen" empty="Sin compras en el rango.">
          {(f?.purchased.bySource ?? []).map((r) => (
            <Row key={r.source} label={r.source} value={`${fmt(r.count)} · $${fmt(r.usd)}`} />
          ))}
        </BreakdownCard>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">
          Auspiciadores YouTube — web vs WhatsApp
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Tipito Enojado, Herederos de Alberdi y Eldo Larcito en el rango seleccionado.
        </p>
        <SponsorBreakdownTable rows={data?.sponsorBreakdown ?? []} />
      </section>

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

      {emailModalOpen ? (
        <EmailLeadsModal
          loading={emailLeadsLoading}
          error={emailLeadsError}
          leads={emailLeads}
          rangeFrom={from}
          rangeTo={to}
          onClose={() => setEmailModalOpen(false)}
        />
      ) : null}

      {unlockModalOpen ? (
        <UnlockClicksModal
          loading={unlockLoading}
          error={unlockError}
          detail={unlockDetail}
          rangeFrom={from}
          rangeTo={to}
          onClose={() => setUnlockModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  web: 'Web',
  whatsapp_yt: 'WhatsApp',
  whatsapp: 'WhatsApp',
};

function EmailLeadsModal({
  loading,
  error,
  leads,
  rangeFrom,
  rangeTo,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  leads: EmailLead[] | null;
  rangeFrom: string;
  rangeTo: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = leads?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de leads que dejaron email"
        className="relative my-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Dejaron su email</h2>
              <p className="text-xs text-slate-500">
                {rangeFrom} → {rangeTo}
                {!loading && !error ? ` · ${fmt(total)} ${total === 1 ? 'lead' : 'leads'}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle...
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : total === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No hay emails dejados en este rango de fechas.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {(leads ?? []).map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-violet-200 hover:bg-violet-50/40"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="truncate text-sm font-semibold text-slate-900 hover:text-violet-700 hover:underline"
                        >
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-sm font-semibold text-slate-400">Sin email</span>
                      )}
                      {lead.refCode ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-800">
                          ref={lead.refCode}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">sin ref</span>
                      )}
                      {lead.tier ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            lead.tier === 'gold'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {lead.tier}
                        </span>
                      ) : null}
                      {lead.utmMedium ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                          {lead.utmMedium}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{lead.brandName || lead.domain || '—'}</span>
                      </span>
                      {lead.domain ? (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.domain}</span>
                        </span>
                      ) : null}
                      {lead.sourceChannel ? (
                        <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 font-medium text-slate-600">
                          {SOURCE_LABEL[lead.sourceChannel] ?? lead.sourceChannel}
                        </span>
                      ) : null}
                    </div>
                    {lead.status === 'completed' ? (
                      <div className="mt-2">
                        <DiagnosticReportLink
                          diagnosticId={lead.id}
                          tier={lead.tier}
                          status={lead.status}
                          label="Ver diagnóstico"
                        />
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    {fmtDateTime(lead.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function UnlockClicksModal({
  loading,
  error,
  detail,
  rangeFrom,
  rangeTo,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  detail: UnlockClicksResponse | null;
  rangeFrom: string;
  rangeTo: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const links = detail?.links ?? detail?.items ?? [];
  const domains = detail?.domains ?? [];
  const clientClicks = detail?.clientClicks ?? [];
  const total = detail?.totalClicks ?? detail?.total ?? links.reduce((acc, r) => acc + r.count, 0);
  const uniqueVisitors = detail?.uniqueVisitors ?? 0;
  const uniqueDomains = detail?.uniqueDomains ?? domains.length;

  const informeV225KeySet = useMemo(
    () => new Set<string>(INFORME_DIAGNOSTICO_V225_UNLOCK_LINKS.map((l) => l.key as string)),
    [],
  );
  const informeV225Links = useMemo(() => {
    const byKey = new Map(links.map((row) => [row.unlockKey, row]));
    return INFORME_DIAGNOSTICO_V225_UNLOCK_LINKS.map((def) => {
      const row = byKey.get(def.key);
      return {
        unlockKey: def.key,
        label: def.label,
        count: row?.count ?? 0,
      };
    });
  }, [links]);
  const otherLinks = links.filter((row) => !informeV225KeySet.has(row.unlockKey));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de clics Plan Conquistar"
        className="relative my-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Clics Plan Conquistar</h2>
              <p className="text-xs text-slate-500">
                {rangeFrom} → {rangeTo}
                {!loading && !error ? ` · ${fmt(total)} ${total === 1 ? 'clic' : 'clics'}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle...
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : total === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No hay clics al Plan Conquistar en este rango de fechas.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Clics totales" value={fmt(total)} />
                <MiniStat label="Clientes distintos" value={fmt(uniqueVisitors)} />
                <MiniStat label="Sitios / marcas" value={fmt(uniqueDomains)} />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Por cliente (cada clic)
                </h3>
                {clientClicks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                    Sin clics en este rango.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {clientClicks.map((row, idx) => (
                      <li
                        key={`${row.clickedAt}-${row.unlockKey}-${idx}`}
                        className="rounded-xl border border-slate-100 bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {row.brandName || row.domain || row.email || 'Sin diagnóstico vinculado'}
                            </p>
                            {row.domain && row.brandName ? (
                              <p className="truncate text-xs text-slate-500">{row.domain}</p>
                            ) : null}
                            {row.email ? (
                              <p className="truncate text-xs text-slate-500">{row.email}</p>
                            ) : null}
                            <p className="mt-1 text-xs text-violet-700">{row.ctaLabel}</p>
                          </div>
                          <p className="shrink-0 text-[11px] text-slate-400">{fmtDateTime(row.clickedAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Por botón o enlace · Informe v2.25
                </h3>
                <ul className="space-y-2">
                  {informeV225Links.map((row) => (
                    <li
                      key={row.unlockKey}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                    >
                      <span className="min-w-0 text-sm font-medium text-slate-800">{row.label}</span>
                      <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-violet-800">
                        {fmt(row.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {otherLinks.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Otros enlaces
                </h3>
                <ul className="space-y-2">
                  {otherLinks.map((row) => (
                    <li
                      key={row.unlockKey}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                    >
                      <span className="min-w-0 text-sm font-medium text-slate-800">{row.label}</span>
                      <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-violet-800">
                        {fmt(row.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sitios / marcas que clickearon
                </h3>
                {domains.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                    Sin sitio o marca asociada (clics desde landing sin diagnóstico).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {domains.map((row) => (
                      <li
                        key={row.domain}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{row.domain}</p>
                          {row.brandName ? (
                            <p className="truncate text-xs text-slate-500">{row.brandName}</p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-slate-400">
                            Último clic: {fmtDateTime(row.lastClickAt)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-emerald-800">
                          {fmt(row.clicks)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelCard({
  icon,
  label,
  value,
  pct,
  pctHint,
  pctLines,
  hint,
  onClick,
  actionHint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct?: string;
  pctHint?: string;
  pctLines?: Array<{ pct: number | null; label: string }>;
  hint?: React.ReactNode;
  onClick?: () => void;
  actionHint?: string;
}) {
  const clickable = typeof onClick === 'function';
  const className = `group rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
    clickable
      ? 'border-violet-200 hover:border-violet-300 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-200'
      : 'border-slate-200'
  }`;
  const pctBlock = pctLines?.length ? (
    <div className="mt-1 min-h-[2.5rem] space-y-0.5">
      {pctLines.map((line) => (
        <p key={line.label} className="leading-tight">
          <span className="text-sm font-semibold text-emerald-600">{pctLabel(line.pct)}</span>{' '}
          <span className="text-[10px] text-slate-400">{line.label}</span>
        </p>
      ))}
    </div>
  ) : (
    <div className="mt-1 min-h-[2.5rem] flex items-baseline gap-1">
      <span className="text-sm font-semibold text-emerald-600">{pct}</span>
      {pctHint ? <span className="text-[10px] text-slate-400">{pctHint}</span> : null}
    </div>
  );
  const inner = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {pctBlock}
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
