'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode, Suspense } from 'react';
import {
  BarChart3,
  Bot,
  ExternalLink,
  Filter,
  FileSpreadsheet,
  FileText,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  Plus,
  Save,
  ScanSearch,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AuditoriaAgenticaDashboard } from '@/components/auditoria/auditoria-agentica-dashboard';
import { DiscoveryDashboard } from '@/components/discovery/discovery-dashboard';
import { EmailEnviosDashboard } from '@/components/email/email-envios-dashboard';
import { EmailPlantillasDashboard } from '@/components/email/email-plantillas-dashboard';
import { EmailSecuenciaDashboard } from '@/components/email/email-secuencia-dashboard';
import { ConversionMetricsDashboard } from '@/components/conversion/conversion-metrics-dashboard';
import { FunnelDashboard, type FunnelMetrics } from '@/components/funnel/funnel-dashboard';
import { ReferidoresDashboard } from '@/components/referidores/referidores-dashboard';
import { SponsorLinkBuilder } from '@/components/tools/sponsor-link-builder';
import { AcquisitionReportDashboard } from '@/components/reportes/acquisition-report-dashboard';
import { EmailOutreachReportDashboard } from '@/components/reportes/email-outreach-report-dashboard';
import { OnboardingReportDashboard } from '@/components/reportes/onboarding-report-dashboard';
import { ReportesHub } from '@/components/reportes/reportes-hub';
import { createPortalEmailDemoFetch } from '@/lib/portal-email-demo-data';
import {
  loadPortalGraficoEmailLeads,
  loadPortalGraficoMetrics,
  loadPortalGraficoUnlockClicks,
} from '@/lib/portal-grafico-demo-data';
import { createPortalReportesLoaders } from '@/lib/portal-reportes-demo-data';
import { createPortalAuditoriaFetch, setAdminUiFetchOverride } from '@/lib/admin-ui-client-fetch';
import { StitchFrame } from './stitch-frame';
import { STITCH_SCREEN_BY_SECTION } from './stitch-screens';

type SectionId =
  | 'dashboard'
  | 'trafico'
  | 'funnel'
  | 'sov'
  | 'oportunidades'
  | 'contenido'
  | 'outside-links'
  | 'keywords'
  | 'llm-hub'
  | 'referidos-campanas'
  | 'email'
  | 'email-templates'
  | 'email-envios'
  | 'redes'
  | 'convertir'
  | 'clientes'
  | 'auditoria'
  | 'reportes'
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

/** Misma estructura que Stitch · Cleexs Agency. */
const NAV: NavSection[] = [
  {
    title: 'Negocio',
    links: [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'trafico', label: 'Tráfico', icon: TrendingUp },
      { id: 'reportes', label: 'Reportes', icon: FileSpreadsheet },
      { id: 'funnel', label: 'Funnel', icon: Filter },
      { id: 'clientes', label: 'Clientes', icon: Users },
      { id: 'referidos-campanas', label: 'Referidos y Campañas', icon: MousePointerClick },
    ],
  },
  {
    title: 'Visibilidad IA',
    links: [
      { id: 'sov', label: 'AI Share of Voice', icon: Sparkles },
      { id: 'oportunidades', label: 'Oportunidades', icon: Search },
      { id: 'contenido', label: 'Contenido', icon: FileText },
      { id: 'outside-links', label: 'Outside links', icon: ExternalLink },
      { id: 'keywords', label: 'Keywords / Productos', icon: KeyRound },
      { id: 'llm-hub', label: 'Hub LLM', icon: MessageSquare },
      { id: 'auditoria', label: 'Auditoría', icon: ScanSearch },
    ],
  },
  {
    title: 'Crecimiento',
    links: [
      { id: 'email', label: 'Email secuencias', icon: Mail },
      { id: 'email-templates', label: 'Plantillas', icon: Mail },
      { id: 'email-envios', label: 'Envíos', icon: Send },
      { id: 'redes', label: 'Redes / Teo', icon: Share2 },
      { id: 'convertir', label: 'Convertir', icon: Target },
    ],
  },
  {
    title: 'Sistema',
    links: [{ id: 'settings', label: 'Configuración / Integraciones', icon: Settings }],
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
  { name: 'Agente de Reclamos', skus: 1, page: 'Lista', sovHits: 9, status: 'Indexada', source: 'existente' as const },
  { name: 'Agente de Seguimiento', skus: 1, page: 'Lista', sovHits: 7, status: 'Indexada', source: 'existente' as const },
  { name: 'Agente de Coordinación', skus: 1, page: 'En progreso', sovHits: 3, status: 'Borrador', source: 'teo' as const },
  { name: 'Agente de Atención clientes', skus: 1, page: 'Lista', sovHits: 5, status: 'Indexada', source: 'existente' as const },
  { name: 'Agente de Planificación viajes', skus: 1, page: 'Pendiente', sovHits: 1, status: '—', source: 'teo' as const },
  { name: 'Agente de Documentación', skus: 1, page: 'Lista', sovHits: 4, status: 'Indexada', source: 'existente' as const },
  { name: 'Agente de Alertas operativas', skus: 1, page: 'Lista', sovHits: 6, status: 'Indexada', source: 'teo' as const },
  { name: 'Agente de Reportes', skus: 1, page: 'En progreso', sovHits: 2, status: 'Borrador', source: 'teo' as const },
];

const BUSINESS_CHART = [
  { label: 'Ene', mrr: 12, pipeline: 28, demos: 9 },
  { label: 'Feb', mrr: 14, pipeline: 32, demos: 11 },
  { label: 'Mar', mrr: 16, pipeline: 35, demos: 14 },
  { label: 'Abr', mrr: 19, pipeline: 41, demos: 18 },
  { label: 'May', mrr: 22, pipeline: 48, demos: 21 },
  { label: 'Jun', mrr: 26, pipeline: 52, demos: 23 },
  { label: 'Jul', mrr: 29, pipeline: 58, demos: 27 },
  { label: 'Ago', mrr: 34, pipeline: 64, demos: 31 },
];

const TRAFFIC_SOURCES = [
  { source: 'Orgánico', visits: 4200, conv: 3.2 },
  { source: 'LLM / IA', visits: 1860, conv: 5.8 },
  { source: 'Referidos', visits: 940, conv: 4.1 },
  { source: 'Paid', visits: 710, conv: 2.4 },
  { source: 'Directo', visits: 1280, conv: 1.9 },
  { source: 'Email', visits: 580, conv: 6.2 },
];

const TRAFFIC_LLMS = [
  { llm: 'ChatGPT', visits: 820, cites: 14 },
  { llm: 'Perplexity', visits: 510, cites: 11 },
  { llm: 'Gemini', visits: 340, cites: 7 },
  { llm: 'Claude', visits: 190, cites: 5 },
];

const TRAFFIC_PROMPTS = [
  { prompt: 'agentes de IA para logística Argentina', visits: 240, sov: true },
  { prompt: 'automatizar reclamos de envíos con IA', visits: 180, sov: true },
  { prompt: 'sistema operativo de logística SOL', visits: 150, sov: true },
  { prompt: 'empleados virtuales para pymes de transporte', visits: 95, sov: false },
  { prompt: 'IA para seguimiento de camiones 24/7', visits: 88, sov: false },
];

const OUTSIDE_LINKS = [
  {
    domain: 'beetrack.com/blog',
    why: 'Guías profundas + citas en directorios logísticos',
    action: 'Pedir guest post / ser source',
    status: 'Pendiente',
  },
  {
    domain: 'enviame.io/recursos',
    why: 'Rankea por “seguimiento de envíos IA”',
    action: 'Comparar contenido + outreach',
    status: 'En curso',
  },
  {
    domain: 'logistec.com.ar',
    why: 'Lista de software Latam sin Empliados',
    action: 'Contactar para inclusión',
    status: 'Pendiente',
  },
  {
    domain: 'project44.com/library',
    why: 'Authority en visibility; LLMs lo citan',
    action: 'Benchmark + partnership',
    status: 'Investigar',
  },
];

const PRODUCT_PAGES = [
  {
    product: 'Agente de Reclamos',
    kwds: ['reclamos envíos IA', 'automatizar reclamos logística'],
    page: '/agentes/reclamos',
    status: 'Publicada',
  },
  {
    product: 'Agente de Seguimiento',
    kwds: ['seguimiento camiones 24/7', 'tracking envíos IA'],
    page: '/agentes/seguimiento',
    status: 'Publicada',
  },
  {
    product: 'Agente de Coordinación',
    kwds: ['coordinar choferes oficina', 'dispatch IA'],
    page: '/agentes/coordinacion',
    status: 'Borrador',
  },
  {
    product: 'SOL completo',
    kwds: ['sistema operativo logística', 'SOL agentes IA'],
    page: '/sol',
    status: 'En progreso',
  },
];

const LLM_HUB_PAGES = [
  { path: 'llm.empliados.net/faq/reclamos', type: 'FAQ', posts: 12, updated: 'Hoy' },
  { path: 'llm.empliados.net/faq/seguimiento', type: 'FAQ', posts: 9, updated: 'Ayer' },
  { path: 'llm.empliados.net/articulos', type: 'Artículos', posts: 18, updated: 'Hace 2d' },
  { path: 'llm.empliados.net/agentica', type: 'Agentica', posts: 6, updated: 'Hoy' },
];

const TEO_POSTS = [
  { channel: 'LinkedIn', title: 'Cómo un agente cierra reclamos en 4 min', when: 'Hoy 09:10', status: 'Programado' },
  { channel: 'X', title: 'SOL · 3 prompts que ya citan Empliados', when: 'Ayer', status: 'Publicado' },
  { channel: 'LinkedIn', title: 'Outside link: por qué Beetrack rankea', when: 'Mañana 10:00', status: 'Borrador Teo' },
  { channel: 'Instagram', title: 'Carousel · 1 página por producto', when: 'Vie', status: 'Cola' },
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
  const maxPipe = Math.max(...BUSINESS_CHART.map((d) => d.pipeline));
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Dashboard"
        subtitle="Chart de negocios primero · luego embudo de conversión Empliados."
      />

      <Panel
        title="Chart de negocios"
        action={<Badge tone="emerald">MRR · Pipeline · Demos</Badge>}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card icon={<TrendingUp className="h-4 w-4" />} label="MRR" value="US$ 34k" hint="+18% vs mes ant." accent="text-emerald-600" />
          <Card icon={<Target className="h-4 w-4" />} label="Pipeline" value="US$ 64k" hint="12 deals abiertos" accent="text-sky-600" />
          <Card icon={<Bot className="h-4 w-4" />} label="Demos mes" value="31" hint="Activaciones agentes" accent="text-violet-600" />
        </div>
        <div className="flex h-48 items-end gap-2 sm:gap-3">
          {BUSINESS_CHART.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end justify-center gap-0.5" style={{ height: '100%' }}>
                <div
                  className="w-[28%] rounded-t bg-emerald-500/90"
                  style={{ height: `${(d.mrr / maxPipe) * 100}%` }}
                  title={`MRR ${d.mrr}k`}
                />
                <div
                  className="w-[28%] rounded-t bg-sky-500/80"
                  style={{ height: `${(d.pipeline / maxPipe) * 100}%` }}
                  title={`Pipeline ${d.pipeline}k`}
                />
                <div
                  className="w-[28%] rounded-t bg-violet-500/70"
                  style={{ height: `${(d.demos / maxPipe) * 100}%` }}
                  title={`Demos ${d.demos}`}
                />
              </div>
              <span className="text-[10px] text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Verde = MRR · Azul = pipeline · Violeta = demos. Datos demo Agency.
        </p>
      </Panel>

      <ConversionMetricsDashboard
        mode="portal"
        title="Conversión"
        loadMetrics={loadPortalGraficoMetrics}
        loadEmailLeads={loadPortalGraficoEmailLeads}
        loadUnlockClicks={loadPortalGraficoUnlockClicks}
      />
    </div>
  );
}

function TraficoView() {
  const maxVisits = Math.max(...TRAFFIC_SOURCES.map((s) => s.visits));
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tráfico"
        subtitle="Por fuentes, por LLM y por prompt · métricas de adquisición Agency."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<Globe2 className="h-4 w-4" />} label="Visitas 30d" value="9.570" hint="Todos los canales" accent="text-sky-600" />
        <Card icon={<Sparkles className="h-4 w-4" />} label="Desde LLMs" value="1.860" hint="19% del total" accent="text-violet-600" />
        <Card icon={<TrendingUp className="h-4 w-4" />} label="Conv. LLM" value="5,8%" hint="Mejor canal" accent="text-emerald-600" />
      </div>

      <Panel title="Por fuentes">
        <div className="space-y-3">
          {TRAFFIC_SOURCES.map((row) => (
            <div key={row.source} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
              <span className="font-medium text-slate-800">{row.source}</span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${(row.visits / maxVisits) * 100}%` }}
                />
              </div>
              <span className="tabular-nums text-slate-600">
                {row.visits.toLocaleString('es-AR')} · {row.conv}%
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Por LLM">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2 pr-4 font-semibold">Motor</th>
                  <th className="pb-2 pr-4 font-semibold">Visitas</th>
                  <th className="pb-2 font-semibold">Citas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {TRAFFIC_LLMS.map((r) => (
                  <tr key={r.llm}>
                    <td className="py-2.5 pr-4 font-medium">{r.llm}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{r.visits.toLocaleString('es-AR')}</td>
                    <td className="py-2.5 tabular-nums">{r.cites}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Por prompt">
          <ul className="space-y-3 text-sm">
            {TRAFFIC_PROMPTS.map((p) => (
              <li key={p.prompt} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{p.prompt}</p>
                  <p className="text-xs text-slate-500">{p.visits} visitas · 30d</p>
                </div>
                {p.sov ? <Badge tone="emerald">SOV</Badge> : <Badge tone="slate">Gap</Badge>}
              </li>
            ))}
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
  const [tab, setTab] = useState<'existente' | 'teo'>('existente');
  const rows = AGENTS.filter((a) => (tab === 'teo' ? a.source === 'teo' : a.source === 'existente'));
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Contenido"
        subtitle="Separá lo ya publicado del sitio de lo generado por Teo."
      />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['existente', 'Ya existente'],
            ['teo', 'Generado por Teo'],
          ] as const
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
      <div className="grid gap-3 sm:grid-cols-3">
        <Card
          icon={<FileText className="h-4 w-4" />}
          label={tab === 'teo' ? 'Piezas Teo' : 'Páginas existentes'}
          value={String(rows.length)}
          hint={tab === 'teo' ? 'Borradores + publicados' : 'En el CMS / sitio'}
          accent="text-violet-600"
        />
        <Card icon={<Globe2 className="h-4 w-4" />} label="FAQ IA" value="4" hint="Hubs temáticos" accent="text-sky-600" />
        <Card icon={<ScanSearch className="h-4 w-4" />} label="Indexadas" value="6" hint="GSC + bots IA" accent="text-emerald-600" />
      </div>
      <Panel title={tab === 'teo' ? 'Cola Teo' : 'Agentes · contenido existente'}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Agente</th>
                <th className="pb-2 pr-4 font-semibold">Página</th>
                <th className="pb-2 pr-4 font-semibold">Hits SOV</th>
                <th className="pb-2 pr-4 font-semibold">Origen</th>
                <th className="pb-2 font-semibold">Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((p) => (
                <tr key={p.name}>
                  <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                  <td className="py-2.5 pr-4">{p.page}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{p.sovHits}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={p.source === 'teo' ? 'violet' : 'slate'}>
                      {p.source === 'teo' ? 'Teo' : 'Existente'}
                    </Badge>
                  </td>
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

function OutsideLinksView() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Outside links"
        subtitle="Compará por qué rankean otros · contactá para ser source o pedir link."
      />
      <Panel title="Oportunidades de link / source">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Dominio</th>
                <th className="pb-2 pr-4 font-semibold">Por qué rankea</th>
                <th className="pb-2 pr-4 font-semibold">Acción</th>
                <th className="pb-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {OUTSIDE_LINKS.map((r) => (
                <tr key={r.domain}>
                  <td className="py-2.5 pr-4 font-medium text-violet-700">{r.domain}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{r.why}</td>
                  <td className="py-2.5 pr-4">{r.action}</td>
                  <td className="py-2.5">
                    <Badge tone={r.status === 'En curso' ? 'emerald' : r.status === 'Investigar' ? 'amber' : 'slate'}>
                      {r.status}
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

function KeywordsView() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Keywords / Productos"
        subtitle="Abanico de kwds y prompts · 1 página por producto (contenido + fotos)."
      />
      <Panel title="Páginas objetivo">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Producto</th>
                <th className="pb-2 pr-4 font-semibold">Keywords / prompts</th>
                <th className="pb-2 pr-4 font-semibold">URL</th>
                <th className="pb-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {PRODUCT_PAGES.map((r) => (
                <tr key={r.product}>
                  <td className="py-2.5 pr-4 font-medium">{r.product}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {r.kwds.map((k) => (
                        <Badge key={k} tone="slate">
                          {k}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{r.page}</td>
                  <td className="py-2.5">
                    <Badge tone={r.status === 'Publicada' ? 'emerald' : r.status === 'Borrador' ? 'amber' : 'violet'}>
                      {r.status}
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

function LlmHubView() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Hub LLM"
        subtitle="FAQs, artículos y parte agentica en llm.empliados.net · muchas páginas para LLMs."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<MessageSquare className="h-4 w-4" />} label="FAQs" value="21" hint="2 hubs" accent="text-violet-600" />
        <Card icon={<FileText className="h-4 w-4" />} label="Artículos" value="18" hint="llm.empliados.net" accent="text-sky-600" />
        <Card icon={<Bot className="h-4 w-4" />} label="Agentica" value="6" hint="Flujos / demos" accent="text-emerald-600" />
      </div>
      <Panel title="Mapa del hub">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Path</th>
                <th className="pb-2 pr-4 font-semibold">Tipo</th>
                <th className="pb-2 pr-4 font-semibold">Posts</th>
                <th className="pb-2 font-semibold">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {LLM_HUB_PAGES.map((r) => (
                <tr key={r.path}>
                  <td className="py-2.5 pr-4 font-mono text-xs text-violet-700">{r.path}</td>
                  <td className="py-2.5 pr-4">{r.type}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{r.posts}</td>
                  <td className="py-2.5 text-slate-500">{r.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function RedesTeoView() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Redes / Teo"
        subtitle="Teo posteando seguido · cola del posteador en redes sociales."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<Share2 className="h-4 w-4" />} label="Posts 7d" value="9" hint="LinkedIn · X · IG" accent="text-violet-600" />
        <Card icon={<Bot className="h-4 w-4" />} label="Cola Teo" value="4" hint="Pendientes" accent="text-amber-600" />
        <Card icon={<Megaphone className="h-4 w-4" />} label="Engagement" value="+22%" hint="vs semana ant." accent="text-emerald-600" />
      </div>
      <Panel
        title="Cola del posteador"
        action={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo post
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Canal</th>
                <th className="pb-2 pr-4 font-semibold">Título</th>
                <th className="pb-2 pr-4 font-semibold">Cuándo</th>
                <th className="pb-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {TEO_POSTS.map((r) => (
                <tr key={`${r.channel}-${r.title}`}>
                  <td className="py-2.5 pr-4 font-medium">{r.channel}</td>
                  <td className="py-2.5 pr-4">{r.title}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{r.when}</td>
                  <td className="py-2.5">
                    <Badge
                      tone={
                        r.status === 'Publicado'
                          ? 'emerald'
                          : r.status === 'Programado'
                            ? 'violet'
                            : r.status.includes('Teo')
                              ? 'amber'
                              : 'slate'
                      }
                    >
                      {r.status}
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

function ConvertirView() {
  const items = [
    { title: 'Hero CTA único', detail: 'Un solo botón primario · “Pedir demo” por encima del fold.' },
    { title: 'Prueba social arriba', detail: 'Logos / “X operadores activos” antes del scroll.' },
    { title: 'Form corto', detail: 'Email + WhatsApp · sin fricción; enrichment después.' },
    { title: 'Objeciones en FAQ', detail: 'Precio, onboarding, TMS · visibles cerca del CTA.' },
    { title: 'Landing por producto', detail: '1 página / agente con fotos reales del flujo.' },
    { title: 'A/B copy Claude', detail: 'Probar variantes de headline sugeridas en la call.' },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Convertir"
        subtitle="Optimizar la landing de compra · checklist de la sesión Agency."
      />
      <Panel title="Prioridades landing">
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={it.title} className="flex gap-3 rounded-xl border border-slate-100 px-3 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{it.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{it.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function ReferidosCampanasView() {
  const [tab, setTab] = useState<'referidos' | 'campanas'>('campanas');
  const fetcher = useCallback((path: string, init?: RequestInit) => fetch(path, { ...init, cache: 'no-store' }), []);

  return (
    <div className="space-y-4">
      <div className={tab === 'campanas' ? '' : 'mx-auto max-w-6xl px-4 pt-6 md:px-8'}>
        <div className={tab === 'campanas' ? 'px-4 pt-6 sm:px-6' : ''}>
          <SectionHeader
            title="Referidos y Campañas"
            subtitle="Campañas = links auspiciador · Referidos = ranking y conversiones por ref."
          />
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ['campanas', 'Campañas'],
                ['referidos', 'Referidos'],
              ] as const
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
        </div>
      </div>

      {tab === 'campanas' ? (
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-violet-50/20 px-3 py-6 sm:px-6">
          <SponsorLinkBuilder
            brand={{
              title: 'Campañas',
              subtitle:
                'Generá link web, QR WhatsApp con mensaje de campaña y seguí conversiones por ref (web y WhatsApp) para Empliados.',
              rankingHint: 'Las campañas alimentan Referidos del portal (ranking por código ref).',
              marketingHomeLabel: 'home de empliados.net',
              marketingBaseUrl: 'https://empliados.net',
              hideMark: true,
              defaultSponsorName: 'Revista Logística',
              defaultRef: 'revista_logistica',
              defaultUtmCampaign: 'empliados_demo',
            }}
          />
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pb-6 md:px-8">
          <ReferidoresDashboard apiBase="/api/borrador/portal-referrals" fetcher={fetcher} />
        </div>
      )}
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

function ClientesView() {
  const rows = [
    {
      email: 'ops@transporteandino.com',
      wa: '+54 9 11 …',
      company: 'Transporte Andino SA',
      industry: 'Transporte de carga',
      size: '40 unidades',
      geo: 'CABA / GBA',
      product: 'Reclamos + Seguimiento',
      enrich: 'Clearbit · LinkedIn',
      score: 82,
    },
    {
      email: 'ceo@rutasur.com.ar',
      wa: '+54 9 351 …',
      company: 'Ruta Sur Logística',
      industry: '3PL',
      size: '25+ viajes/día',
      geo: 'Córdoba',
      product: 'SOL completo',
      enrich: 'Apollo · manual',
      score: 91,
    },
    {
      email: 'logistica@distribuidorapampa.com',
      wa: '—',
      company: 'Distribuidora Pampa',
      industry: 'Distribución',
      size: '12 depósitos',
      geo: 'Interior AR',
      product: 'Atención clientes',
      enrich: 'Pendiente',
      score: 54,
    },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Clientes"
        subtitle="Enriquecimiento firmográfico → segmentación y email personalizado."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card icon={<Users className="h-4 w-4" />} label="Perfiles" value="3" hint="Demo portal" accent="text-violet-600" />
        <Card icon={<Sparkles className="h-4 w-4" />} label="Enriquecidos" value="2 / 3" hint="Clearbit · Apollo" accent="text-emerald-600" />
        <Card icon={<Target className="h-4 w-4" />} label="Score medio" value="76" hint="Fit Agency" accent="text-sky-600" />
      </div>
      <Panel title="Perfiles enriquecidos">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Empresa</th>
                <th className="pb-2 pr-4 font-semibold">Contacto</th>
                <th className="pb-2 pr-4 font-semibold">Industria / tamaño</th>
                <th className="pb-2 pr-4 font-semibold">Geo</th>
                <th className="pb-2 pr-4 font-semibold">Agentes</th>
                <th className="pb-2 pr-4 font-semibold">Enrich</th>
                <th className="pb-2 font-semibold">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((r) => (
                <tr key={r.email}>
                  <td className="py-2.5 pr-4 font-medium">{r.company}</td>
                  <td className="py-2.5 pr-4">
                    <div>{r.email}</div>
                    <div className="text-xs text-slate-400">{r.wa}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div>{r.industry}</div>
                    <div className="text-xs text-slate-400">{r.size}</div>
                  </td>
                  <td className="py-2.5 pr-4">{r.geo}</td>
                  <td className="py-2.5 pr-4">{r.product}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={r.enrich === 'Pendiente' ? 'amber' : 'emerald'}>{r.enrich}</Badge>
                  </td>
                  <td className="py-2.5 tabular-nums font-semibold text-slate-900">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

type ReportesSubView = 'hub' | 'adquisicion' | 'onboarding' | 'email-outreach';

function ReportesView() {
  const [sub, setSub] = useState<ReportesSubView>('hub');
  const loaders = useMemo(() => createPortalReportesLoaders(), []);

  useEffect(() => {
    setAdminUiFetchOverride(createPortalEmailDemoFetch());
    return () => setAdminUiFetchOverride(null);
  }, []);

  if (sub !== 'hub') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSub('hub')}
          className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900"
        >
          ← Volver a Reportes
        </button>
        {sub === 'adquisicion' ? (
          <AcquisitionReportDashboard
            mode="portal"
            loadAcquisition={loaders.acquisition}
            searchDiagnostics={loaders.searchDiagnostics}
          />
        ) : null}
        {sub === 'onboarding' ? (
          <OnboardingReportDashboard mode="portal" loadOnboarding={loaders.onboardingProfile} />
        ) : null}
        {sub === 'email-outreach' ? (
          <EmailOutreachReportDashboard mode="portal" loadEmailOutreach={loaders.emailOutreach} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reportes"
        subtitle="Métricas Empliados · adquisición, onboarding y email (datos demo, mismo UI que admin)."
      />
      <ReportesHub
        mode="portal"
        variants={['adquisicion', 'onboarding', 'email-outreach']}
        onOpen={(id) => setSub(id)}
      />
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
  const stitchSrc = STITCH_SCREEN_BY_SECTION[id];
  if (stitchSrc) {
    const label =
      NAV.flatMap((g) => g.links).find((l) => l.id === id)?.label ?? id;
    return <StitchFrame src={stitchSrc} title={label} />;
  }

  switch (id) {
    case 'trafico':
      return <TraficoView />;
    case 'funnel':
      return <FunnelView />;
    case 'sov':
      return <SovView />;
    case 'oportunidades':
      return <OportunidadesView />;
    case 'contenido':
      return <ContenidoView />;
    case 'outside-links':
      return <OutsideLinksView />;
    case 'keywords':
      return <KeywordsView />;
    case 'llm-hub':
      return <LlmHubView />;
    case 'referidos-campanas':
      return <ReferidosCampanasView />;
    case 'email':
      return <EmailSecuenciaView />;
    case 'email-templates':
      return <EmailPlantillasView onGoEnvios={() => setSection('email-envios')} />;
    case 'email-envios':
      return <EmailEnviosView onGoTemplates={() => setSection('email-templates')} />;
    case 'redes':
      return <RedesTeoView />;
    case 'convertir':
      return <ConvertirView />;
    case 'clientes':
      return <ClientesView />;
    case 'reportes':
      return <ReportesView />;
    case 'auditoria':
      return <AuditoriaView />;
    case 'settings':
      return <SettingsView />;
    case 'dashboard':
      return <DashboardView />;
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

  const isStitch = Boolean(STITCH_SCREEN_BY_SECTION[section]);

  useEffect(() => {
    const id = 'agency-stitch-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background: '#faf8ff',
        fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
      }}
    >
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#e2e8f0] bg-white/90 px-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4648d4] text-xs font-bold text-white shadow-sm">
            C
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4648d4]">Cleexs Agency</p>
            <p className="text-sm font-semibold text-[#0f172a]">Portal Empliados</p>
          </div>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xs font-medium text-[#0f172a]">empliados.net</p>
          <p className="text-[10px] text-[#64748b]">Workspace activo</p>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-[#e2e8f0] bg-white py-5 md:block">
          <nav className="flex flex-col gap-5 px-3">
            {NAV.map((group) => (
              <div key={group.title} className="flex flex-col gap-0.5">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                  {group.title}
                </p>
                {group.links.map(({ id, label, icon: Icon }) => {
                  const active = section === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${
                        active
                          ? 'bg-[#eef2ff] text-[#4f46e5] shadow-sm ring-1 ring-[#eef2ff]'
                          : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#6366f1]' : 'text-[#94a3b8]'}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden">
          <nav className="flex gap-2 overflow-x-auto border-b border-[#e2e8f0] bg-white px-4 py-3 md:hidden">
            {NAV.flatMap((g) => g.links).map(({ id, label, icon: Icon }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                    active ? 'bg-[#4648d4] text-white' : 'bg-[#f1f5f9] text-[#334155]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label.split('/')[0]?.trim()}
                </button>
              );
            })}
          </nav>

          {isStitch ? (
            renderSection(section, setSection)
          ) : (
            <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
              {renderSection(section, setSection)}
            </div>
          )}
        </div>
      </div>

      {!isStitch ? (
        <footer className="border-t border-[#e2e8f0] bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-[#64748b] sm:flex-row sm:items-center sm:justify-between">
            <p>Cleexs Agency · {activeLabel}</p>
            <p className="font-medium text-[#4648d4]">empliados.net</p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
