'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode, Suspense } from 'react';
import {
  BarChart3,
  Bot,
  Filter,
  FileText,
  Globe2,
  Link2,
  Loader2,
  Mail,
  MousePointerClick,
  Plus,
  Save,
  ScanSearch,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AuditoriaAgenticaDashboard } from '@/components/auditoria/auditoria-agentica-dashboard';
import { DiscoveryDashboard } from '@/components/discovery/discovery-dashboard';
import { EmailEnviosDashboard } from '@/components/email/email-envios-dashboard';
import { EmailPlantillasDashboard } from '@/components/email/email-plantillas-dashboard';
import { EmailSecuenciaDashboard } from '@/components/email/email-secuencia-dashboard';
import { FunnelDashboard, type FunnelMetrics } from '@/components/funnel/funnel-dashboard';
import { ReferidoresDashboard } from '@/components/referidores/referidores-dashboard';
import { createPortalEmailDemoFetch } from '@/lib/portal-email-demo-data';
import { createPortalAuditoriaFetch, setAdminUiFetchOverride } from '@/lib/admin-ui-client-fetch';

type SectionId =
  | 'dashboard'
  | 'funnel'
  | 'sov'
  | 'oportunidades'
  | 'contenido'
  | 'outreach'
  | 'email'
  | 'email-templates'
  | 'email-envios'
  | 'referidos'
  | 'clientes'
  | 'auditoria'
  | 'settings';

type SettingsTab = 'integraciones' | 'marca' | 'competidores' | 'alertas';

type NavLink = { id: SectionId; label: string; icon: typeof Mail };
type NavSection = { title: string; links: NavLink[] };

type PortalSettings = {
  modules: Record<string, boolean>;
  alerts: {
    contactEmail: string;
    contactName: string;
    scoreDrop: boolean;
    weeklyDigest: boolean;
    newOpportunity: boolean;
  };
  integrations: {
    wordpress: { enabled: boolean; url: string };
    ga4: { enabled: boolean };
    gsc: { enabled: boolean };
    shopify: { enabled: boolean };
    resend: { enabled: boolean };
  };
  notes: string;
};

/** Misma estructura que Trafogli. */
const NAV: NavSection[] = [
  {
    title: 'Negocio',
    links: [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'funnel', label: 'Funnel', icon: Filter },
      { id: 'clientes', label: 'Clientes', icon: Users },
      { id: 'referidos', label: 'Referidos', icon: MousePointerClick },
    ],
  },
  {
    title: 'Visibilidad IA',
    links: [
      { id: 'sov', label: 'AI Share of Voice', icon: Sparkles },
      { id: 'oportunidades', label: 'Oportunidades', icon: Search },
      { id: 'contenido', label: 'Contenido', icon: FileText },
      { id: 'outreach', label: 'Links & Outreach', icon: Link2 },
      { id: 'auditoria', label: 'Auditoría', icon: ScanSearch },
    ],
  },
  {
    title: 'Crecimiento',
    links: [
      { id: 'email', label: 'Email · secuencia', icon: Mail },
      { id: 'email-templates', label: 'Email · plantillas', icon: Mail },
      { id: 'email-envios', label: 'Email · envíos', icon: Send },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

/** Prompts de descubrimiento · agentes IA logística. */
const SOV_PROMPTS = [
  { prompt: 'agentes de IA para logística Argentina', empliados: true, rival: 'Beetrack' },
  { prompt: 'automatizar reclamos de envíos con IA', empliados: true, rival: 'Enviame' },
  { prompt: 'sistema operativo de logística SOL', empliados: true, rival: 'Melonn' },
  { prompt: 'IA para seguimiento de camiones 24/7', empliados: false, rival: 'project44' },
  { prompt: 'agentes IA coordinación choferes y oficina', empliados: true, rival: 'FourKites' },
  { prompt: 'software logística con más de 25 viajes/día', empliados: false, rival: 'Beetrack' },
  { prompt: 'reducir llamadas de seguimiento de envíos', empliados: true, rival: 'Enviame' },
  { prompt: 'empleados virtuales para pymes de transporte', empliados: false, rival: 'Melonn' },
];

const AGENTS = [
  { name: 'Agente de Reclamos', skus: 1, page: 'Lista', sovHits: 9, status: 'Indexada' },
  { name: 'Agente de Seguimiento', skus: 1, page: 'Lista', sovHits: 7, status: 'Indexada' },
  { name: 'Agente de Coordinación', skus: 1, page: 'En progreso', sovHits: 3, status: 'Borrador' },
  { name: 'Agente de Atención clientes', skus: 1, page: 'Lista', sovHits: 5, status: 'Indexada' },
  { name: 'Agente de Planificación viajes', skus: 1, page: 'Pendiente', sovHits: 1, status: '—' },
  { name: 'Agente de Documentación', skus: 1, page: 'Lista', sovHits: 4, status: 'Indexada' },
  { name: 'Agente de Alertas operativas', skus: 1, page: 'Lista', sovHits: 6, status: 'Indexada' },
  { name: 'Agente de Reportes', skus: 1, page: 'En progreso', sovHits: 2, status: 'Borrador' },
];

function Card({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className={accent ?? 'text-slate-500'}>{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-[11px] leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </header>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Badge({
  children,
  tone = 'violet',
}: {
  children: ReactNode;
  tone?: 'violet' | 'emerald' | 'amber' | 'slate';
}) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-900 ring-amber-200/80'
        : tone === 'slate'
          ? 'bg-slate-100 text-slate-700 ring-slate-200'
          : 'bg-violet-50 text-violet-800 ring-violet-200/80';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {children}
    </span>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-200 focus:ring-2';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left hover:bg-slate-50"
    >
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      <span className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-violet-600' : 'bg-slate-300'}`}>
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

function DashboardView() {
  const wins = SOV_PROMPTS.filter((p) => p.empliados).length;
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard"
        subtitle="Vista ejecutiva Empliados · agentes activos + visibilidad en IA."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<Bot className="h-4 w-4" />} label="Agentes activos" value="48" hint="En operaciones de clientes" accent="text-emerald-600" />
        <Card icon={<TrendingUp className="h-4 w-4" />} label="Demos 7d" value="23" hint="+18% vs semana ant." accent="text-sky-600" />
        <Card
          icon={<Sparkles className="h-4 w-4" />}
          label="AI Share of Voice"
          value={`${Math.round((wins / 50) * 1000) / 10}%`}
          hint={`${wins} / 50 prompts · semanal`}
          accent="text-violet-600"
        />
        <Card icon={<BarChart3 className="h-4 w-4" />} label="Cleexs Score" value="54" hint="Actualizado lunes" accent="text-indigo-600" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tendencia SOV (8 semanas)">
          <div className="flex h-36 items-end gap-2">
            {[3, 4, 4, 5, 6, 7, 8, 10].map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-violet-500/90" style={{ height: `${v * 10}%` }} />
                <span className="text-[10px] text-slate-400">S{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">De 3% → 10% en 8 semanas midiendo los mismos 50 prompts de logística + IA.</p>
        </Panel>
        <Panel title="Próximas acciones Cleexs">
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <Badge>SOV</Badge>
              <span>Publicar página profunda · Agente de Coordinación (7 prompts sin mención).</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="emerald">Email</Badge>
              <span>Activar paso día 12 (2º agente · seguimiento).</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="amber">Outreach</Badge>
              <span>11 directorios donde aparece Beetrack / Enviame y Empliados no.</span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function FunnelView() {
  const today = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

  function addDays(day: string, delta: number): string {
    const [y, m, d] = day.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    dt.setUTCDate(dt.getUTCDate() + delta);
    return dt.toISOString().slice(0, 10);
  }

  function rangeForPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30'): { from: string; to: string } {
    if (preset === 'hoy') return { from: today, to: today };
    if (preset === 'ayer') {
      const yesterday = addDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    const span = preset === '7' ? 6 : preset === '15' ? 14 : 29;
    return { from: addDays(today, -span), to: today };
  }

  const initial = useMemo(() => rangeForPreset('30'), [today]);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string | null>('30');
  const [adSpendInput, setAdSpendInput] = useState('');
  const [data, setData] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const spend = Number(adSpendInput.replace(',', '.'));
      if (Number.isFinite(spend) && spend >= 0 && adSpendInput.trim() !== '') {
        params.set('adSpendUsd', String(spend));
      }
      const res = await fetch(`/api/borrador/portal-funnel?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar el funnel');
      setData(json as FunnelMetrics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to, adSpendInput]);

  useEffect(() => {
    void load();
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30') {
    const r = rangeForPreset(preset);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(preset);
  }

  const periodLabel =
    activePreset === 'hoy'
      ? 'Hoy'
      : activePreset === 'ayer'
        ? 'Ayer'
        : activePreset === '7'
          ? 'Últimos 7 días'
          : activePreset === '15'
            ? 'Últimos 15 días'
            : activePreset === '30'
              ? 'Últimos 30 días'
              : `${from} → ${to}`;

  return (
    <FunnelDashboard
      data={data}
      loading={loading}
      error={error}
      periodLabel={periodLabel}
      from={from}
      to={to}
      activePreset={activePreset}
      onPreset={applyPreset}
      onFromChange={(v) => {
        setFrom(v);
        setActivePreset(null);
      }}
      onToChange={(v) => {
        setTo(v);
        setActivePreset(null);
      }}
      maxTo={today}
      adSpendInput={adSpendInput}
      setAdSpendInput={setAdSpendInput}
      onRefresh={() => void load()}
      onApplySpend={() => void load()}
    />
  );
}

function SovView() {
  const wins = SOV_PROMPTS.filter((p) => p.empliados).length;
  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Share of Voice"
        subtitle="50 prompts objetivo · medición semanal en ChatGPT, Gemini, Perplexity y Claude."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={<Sparkles className="h-4 w-4" />}
          label="SOV actual"
          value={`${Math.round((wins / 50) * 1000) / 10}%`}
          hint={`${wins} menciones / 50 prompts (muestra)`}
          accent="text-violet-600"
        />
        <Card icon={<Globe2 className="h-4 w-4" />} label="Motores" value="4" hint="ChatGPT · Gemini · Perplexity · Claude" accent="text-sky-600" />
        <Card icon={<TrendingUp className="h-4 w-4" />} label="Δ semanal" value="+1 pp" hint="4 → 5 menciones" accent="text-emerald-600" />
        <Card icon={<Users className="h-4 w-4" />} label="Rival #1" value="Beetrack" hint="14 / 50 prompts" accent="text-amber-600" />
      </div>
      <Panel title="Muestra de prompts (8 / 50)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Prompt</th>
                <th className="pb-2 pr-4 font-semibold">Empliados</th>
                <th className="pb-2 font-semibold">Quién gana hoy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SOV_PROMPTS.map((row) => (
                <tr key={row.prompt}>
                  <td className="py-2.5 pr-4 text-slate-800">{row.prompt}</td>
                  <td className="py-2.5 pr-4">
                    {row.empliados ? <Badge tone="emerald">Aparece</Badge> : <Badge tone="slate">No</Badge>}
                  </td>
                  <td className="py-2.5 text-slate-600">{row.empliados ? 'Empliados' : row.rival}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function OportunidadesView() {
  const fetcher = useCallback((path: string, init?: RequestInit) => fetch(path, { ...init, cache: 'no-store' }), []);
  return (
    <DiscoveryDashboard
      workspace="empleados"
      apiBase="/api/borrador/portal-discovery"
      fetcher={fetcher}
    />
  );
}

function ContenidoView() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Contenido"
        subtitle="Páginas profundas por agente (8) + FAQ orientadas a IA · SOL logística."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<FileText className="h-4 w-4" />} label="Páginas profundas" value="5 / 8" hint="Publicadas" accent="text-violet-600" />
        <Card icon={<Globe2 className="h-4 w-4" />} label="FAQ IA" value="4" hint="Hubs temáticos" accent="text-sky-600" />
        <Card icon={<ScanSearch className="h-4 w-4" />} label="Indexadas" value="6" hint="GSC + bots IA" accent="text-emerald-600" />
      </div>
      <Panel title="Agentes principales">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Agente</th>
                <th className="pb-2 pr-4 font-semibold">Módulos</th>
                <th className="pb-2 pr-4 font-semibold">Página</th>
                <th className="pb-2 pr-4 font-semibold">Hits SOV</th>
                <th className="pb-2 font-semibold">Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {AGENTS.map((p) => (
                <tr key={p.name}>
                  <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{p.skus}</td>
                  <td className="py-2.5 pr-4">{p.page}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{p.sovHits}</td>
                  <td className="py-2.5">
                    <Badge tone={p.status === 'Indexada' ? 'emerald' : p.status === 'Borrador' ? 'amber' : 'slate'}>
                      {p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function OutreachView() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Links & Outreach" subtitle="Backlinks + contacting automático (agente Outreach Cleexs)." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<Link2 className="h-4 w-4" />} label="Backlinks activos" value="31" hint="GSC + crawlers" accent="text-violet-600" />
        <Card icon={<Share2 className="h-4 w-4" />} label="Oportunidades" value="11" hint="Donde gana el rival" accent="text-amber-600" />
        <Card icon={<Mail className="h-4 w-4" />} label="Outreach enviados 7d" value="16" hint="Shadow / real" accent="text-sky-600" />
      </div>
      <Panel title="Fuentes donde el rival aparece y Empliados no">
        <ul className="space-y-2 text-sm text-slate-700">
          {[
            'revistalogistica.com.ar — ficha Beetrack',
            'transporteya.net — guía TMS Latam',
            'linkedin.com/pulse — “IA en flotas”',
            'marketplace-saas.io — categoría last mile',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function usePortalEmailApi() {
  useEffect(() => {
    // Mismo código/layout que /admin/email*; datos demo Empliados (no ops Cleexs).
    setAdminUiFetchOverride(createPortalEmailDemoFetch());
    return () => setAdminUiFetchOverride(null);
  }, []);
}

function EmailSecuenciaView() {
  usePortalEmailApi();
  return <EmailSecuenciaDashboard />;
}

function EmailPlantillasView({ onGoEnvios }: { onGoEnvios: () => void }) {
  usePortalEmailApi();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      }
    >
      <EmailPlantillasDashboard mode="portal" onGoEnvios={onGoEnvios} />
    </Suspense>
  );
}

function EmailEnviosView({ onGoTemplates }: { onGoTemplates: () => void }) {
  usePortalEmailApi();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      }
    >
      <EmailEnviosDashboard mode="portal" onGoTemplates={onGoTemplates} />
    </Suspense>
  );
}

function ReferidosView() {
  const fetcher = useCallback((path: string, init?: RequestInit) => fetch(path, { ...init, cache: 'no-store' }), []);
  return <ReferidoresDashboard apiBase="/api/borrador/portal-referrals" fetcher={fetcher} />;
}

function ClientesView() {
  const rows = [
    { email: 'ops@transporteandino.com', wa: '+54 9 11 …', product: 'Reclamos + Seguimiento', tags: 'flota 40, CABA' },
    { email: 'ceo@rutasur.com.ar', wa: '+54 9 351 …', product: 'SOL completo', tags: '25+ viajes/día' },
    { email: 'logistica@distribuidorapampa.com', wa: '—', product: 'Atención clientes', tags: 'piloto, interior' },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Clientes"
        subtitle="Contrato + enriquecimiento → segmentación para email personalizado."
      />
      <Panel title="Perfiles enriquecidos">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Email</th>
                <th className="pb-2 pr-4 font-semibold">WhatsApp</th>
                <th className="pb-2 pr-4 font-semibold">Agentes</th>
                <th className="pb-2 font-semibold">Atributos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((r) => (
                <tr key={r.email}>
                  <td className="py-2.5 pr-4 font-medium">{r.email}</td>
                  <td className="py-2.5 pr-4">{r.wa}</td>
                  <td className="py-2.5 pr-4">{r.product}</td>
                  <td className="py-2.5 text-slate-500">{r.tags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function AuditoriaView() {
  const apiFetch = useMemo(() => createPortalAuditoriaFetch(), []);
  return (
    <AuditoriaAgenticaDashboard
      apiFetch={apiFetch}
      portalCreatedBy="portal-empliados"
      ensureTarget={{ url: 'https://empliados.net', siteLabel: 'Empliados' }}
    />
  );
}

function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('integraciones');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState({
    name: 'Empliados',
    industry: 'Agentes de IA para logística',
    country: 'Argentina',
    description: 'SOL · Sistema Operativo de Logística. Agentes de IA preconfigurados para pymes de transporte y logística.',
    objective: 'Ser la marca #1 en prompts de agentes IA logística en Latam',
    runSchedule: 'semanal' as '' | 'semanal' | 'quincenal' | 'mensual',
  });
  const [competitors, setCompetitors] = useState([
    { name: 'Beetrack', domain: 'beetrack.com' },
    { name: 'Enviame', domain: 'enviame.io' },
    { name: 'Melonn', domain: 'melonn.com' },
    { name: 'project44', domain: 'project44.com' },
    { name: 'FourKites', domain: 'fourkites.com' },
  ]);
  const [settings, setSettings] = useState<PortalSettings | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) return;
      setBrandId(json.brand?.id ?? null);
      if (json.brand) {
        setBrandForm({
          name: json.brand.name || 'Empliados',
          industry: json.brand.industry || 'Agentes de IA para logística',
          country: json.brand.country || 'Argentina',
          description:
            json.brand.description ||
            'SOL · Sistema Operativo de Logística. Agentes de IA preconfigurados para pymes de transporte y logística.',
          objective: json.brand.objective || 'Ser la marca #1 en prompts de agentes IA logística en Latam',
          runSchedule: json.brand.runSchedule || 'semanal',
        });
      }
      if (json.competitors?.length) {
        setCompetitors(json.competitors.map((c: { name: string; domain: string | null }) => ({ name: c.name, domain: c.domain || '' })));
      }
      if (json.settings) setSettings(json.settings);
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(payload: Record<string, unknown>) {
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaveMsg('Guardado');
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const integrationRows = [
    { name: 'CRM / HubSpot', status: 'Conectado' },
    { name: 'Google Analytics 4', status: settings?.integrations.ga4.enabled ? 'Conectado' : 'Pendiente' },
    { name: 'Google Search Console', status: settings?.integrations.gsc.enabled ? 'Conectado' : 'Pendiente' },
    { name: 'WordPress / CMS', status: settings?.integrations.wordpress.enabled ? 'Conectado' : 'Pendiente' },
    { name: 'Resend · email', status: settings?.integrations.resend.enabled ? 'Conectado' : 'Conectado' },
    { name: 'WhatsApp Business', status: 'Conectado' },
    { name: 'TMS / ERP cliente', status: 'Próximo' },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Settings" subtitle="Integraciones y configuración del portal de marca." />
      {(saveMsg || saveErr) && (
        <p className={`text-xs font-medium ${saveErr ? 'text-rose-600' : 'text-emerald-700'}`}>{saveErr || saveMsg}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['integraciones', 'Integraciones'],
            ['marca', 'Marca'],
            ['competidores', 'Competidores'],
            ['alertas', 'Alertas'],
          ] as Array<[SettingsTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === id ? 'bg-violet-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'integraciones' ? (
        <Panel title="Integraciones">
          <div className="space-y-2">
            {integrationRows.map((it) => (
              <div
                key={it.name}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-slate-800">{it.name}</span>
                <Badge tone={it.status === 'Conectado' ? 'emerald' : it.status === 'Próximo' ? 'slate' : 'amber'}>
                  {it.status}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {tab === 'marca' ? (
        <Panel title="Perfil de marca">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input className={inputCls} value={brandForm.name} onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Dominio">
              <input className={inputCls} value="empliados.net" disabled />
            </Field>
            <Field label="Industria">
              <input className={inputCls} value={brandForm.industry} onChange={(e) => setBrandForm((f) => ({ ...f, industry: e.target.value }))} />
            </Field>
            <Field label="País">
              <input className={inputCls} value={brandForm.country} onChange={(e) => setBrandForm((f) => ({ ...f, country: e.target.value }))} />
            </Field>
            <Field label="Frecuencia de corridas">
              <select
                className={inputCls}
                value={brandForm.runSchedule}
                onChange={(e) => setBrandForm((f) => ({ ...f, runSchedule: e.target.value as typeof brandForm.runSchedule }))}
              >
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </Field>
            <Field label="Objetivo">
              <input className={inputCls} value={brandForm.objective} onChange={(e) => setBrandForm((f) => ({ ...f, objective: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descripción">
                <textarea
                  className={`${inputCls} min-h-[96px]`}
                  value={brandForm.description}
                  onChange={(e) => setBrandForm((f) => ({ ...f, description: e.target.value }))}
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={saving || !brandId}
              onClick={() =>
                void save({
                  brand: {
                    name: brandForm.name,
                    industry: brandForm.industry || null,
                    country: brandForm.country || null,
                    description: brandForm.description || null,
                    objective: brandForm.objective || null,
                    runSchedule: brandForm.runSchedule || null,
                  },
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar marca
            </button>
          </div>
        </Panel>
      ) : null}

      {tab === 'competidores' ? (
        <Panel title="Set competitivo">
          <div className="space-y-2">
            {competitors.map((c, idx) => (
              <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className={inputCls}
                  placeholder="Nombre"
                  value={c.name}
                  onChange={(e) => setCompetitors((rows) => rows.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                />
                <input
                  className={inputCls}
                  placeholder="dominio.com"
                  value={c.domain}
                  onChange={(e) => setCompetitors((rows) => rows.map((r, i) => (i === idx ? { ...r, domain: e.target.value } : r)))}
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setCompetitors((rows) => rows.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCompetitors((rows) => [...rows, { name: '', domain: '' }])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar rival
            </button>
            <button
              type="button"
              disabled={saving || !brandId}
              onClick={() =>
                void save({
                  competitors: competitors
                    .filter((c) => c.name.trim())
                    .map((c) => ({ name: c.name.trim(), domain: c.domain.trim() || null })),
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar competidores
            </button>
          </div>
        </Panel>
      ) : null}

      {tab === 'alertas' && settings ? (
        <Panel title="Alertas">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input
                className={inputCls}
                value={settings.alerts.contactName}
                onChange={(e) => setSettings({ ...settings, alerts: { ...settings.alerts, contactName: e.target.value } })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputCls}
                value={settings.alerts.contactEmail}
                onChange={(e) => setSettings({ ...settings, alerts: { ...settings.alerts, contactEmail: e.target.value } })}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-2">
            <Toggle
              checked={settings.alerts.scoreDrop}
              label="Alerta por caída de score"
              onChange={(v) => setSettings({ ...settings, alerts: { ...settings.alerts, scoreDrop: v } })}
            />
            <Toggle
              checked={settings.alerts.weeklyDigest}
              label="Digest semanal"
              onChange={(v) => setSettings({ ...settings, alerts: { ...settings.alerts, weeklyDigest: v } })}
            />
            <Toggle
              checked={settings.alerts.newOpportunity}
              label="Nueva oportunidad"
              onChange={(v) => setSettings({ ...settings, alerts: { ...settings.alerts, newOpportunity: v } })}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={saving || !brandId}
              onClick={() => void save({ settings })}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar alertas
            </button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function renderSection(id: SectionId, setSection: (id: SectionId) => void) {
  switch (id) {
    case 'dashboard':
      return <DashboardView />;
    case 'funnel':
      return <FunnelView />;
    case 'sov':
      return <SovView />;
    case 'oportunidades':
      return <OportunidadesView />;
    case 'contenido':
      return <ContenidoView />;
    case 'outreach':
      return <OutreachView />;
    case 'email':
      return <EmailSecuenciaView />;
    case 'email-templates':
      return <EmailPlantillasView onGoEnvios={() => setSection('email-envios')} />;
    case 'email-envios':
      return <EmailEnviosView onGoTemplates={() => setSection('email-templates')} />;
    case 'referidos':
      return <ReferidosView />;
    case 'clientes':
      return <ClientesView />;
    case 'auditoria':
      return <AuditoriaView />;
    case 'settings':
      return <SettingsView />;
    default:
      return null;
  }
}

export function PortalEmpliadosDraft() {
  const [section, setSection] = useState<SectionId>('dashboard');
  const activeLabel = useMemo(() => {
    for (const s of NAV) {
      const hit = s.links.find((l) => l.id === section);
      if (hit) return hit.label;
    }
    return 'Dashboard';
  }, [section]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
            C
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">Cleexs · borrador</p>
            <p className="text-sm font-semibold text-slate-900">Portal Empliados</p>
          </div>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xs font-medium text-slate-800">empliados.net</p>
          <p className="text-[10px] text-slate-500">Agentes IA · logística</p>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white py-6 md:block">
          <nav className="flex flex-col gap-5 px-3">
            {NAV.map((group) => (
              <div key={group.title} className="flex flex-col gap-0.5">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </p>
                {group.links.map(({ id, label, icon: Icon }) => {
                  const active = section === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                        active
                          ? 'bg-violet-50 text-violet-900 ring-1 ring-violet-200/60'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden">
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            {NAV.flatMap((g) => g.links).map(({ id, label, icon: Icon }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                    active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label.split('·')[0]?.trim()}
                </button>
              );
            })}
          </nav>

          <div
            className={
              section === 'email' || section === 'email-templates' || section === 'email-envios'
                ? 'w-full'
                : 'mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10'
            }
          >
            {renderSection(section, setSection)}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Cleexs · portal Empliados · {activeLabel}</p>
          <p className="font-medium text-violet-700">empliados.net</p>
        </div>
      </footer>
    </div>
  );
}
