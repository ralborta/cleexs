'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
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
  Settings,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';

type SectionId =
  | 'dashboard'
  | 'funnel'
  | 'sov'
  | 'oportunidades'
  | 'contenido'
  | 'outreach'
  | 'email'
  | 'referidos'
  | 'clientes'
  | 'auditoria'
  | 'settings';

type SettingsTab = 'marca' | 'competidores' | 'modulos' | 'integraciones' | 'alertas';

type NavLink = { id: SectionId; label: string; icon: typeof Mail };
type NavSection = { title: string; links: NavLink[] };

type PortalSettings = {
  modules: {
    dashboard: boolean;
    sov: boolean;
    oportunidades: boolean;
    contenido: boolean;
    outreach: boolean;
    auditoria: boolean;
    email: boolean;
    funnelEcommerce: boolean;
  };
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

type Snapshot = {
  ok: boolean;
  domain: string;
  brand: {
    id: string | null;
    name: string;
    domain: string;
    industry: string | null;
    country?: string | null;
    description?: string | null;
    objective?: string | null;
    runSchedule?: 'semanal' | 'quincenal' | 'mensual' | null;
  } | null;
  competitors: Array<{ id?: string; name: string; domain: string | null }>;
  settings: PortalSettings;
  score: {
    cleexsScore: number | null;
    priaTotal: number | null;
    source: string | null;
    updatedAt: string | null;
    diagnosticId: string | null;
  };
  shareOfVoice: {
    percent: number | null;
    brandAppearances: number;
    totalAppearances: number;
    comparison: Array<{
      name: string;
      type: string;
      share: number | null;
      appearances: number | null;
    }>;
  };
  insights: {
    resumenEjecutivo: string | null;
    fortalezas: string[];
    debilidades: string[];
    sugerencias: string[];
    intenciones: Array<{ intencion: string; score: number | null; comentario: string | null }>;
  };
};

/** Misma estructura que Trafogli — no cambiar. */
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
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
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
  tone?: 'violet' | 'emerald' | 'amber' | 'slate' | 'rose';
}) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-900 ring-amber-200/80'
        : tone === 'rose'
          ? 'bg-rose-50 text-rose-800 ring-rose-200/80'
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

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function PortalEmpliadosDraft() {
  const [section, setSection] = useState<SectionId>('dashboard');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('marca');
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [brandForm, setBrandForm] = useState({
    name: '',
    industry: '',
    country: '',
    description: '',
    objective: '',
    runSchedule: '' as '' | 'semanal' | 'quincenal' | 'mensual',
  });
  const [competitors, setCompetitors] = useState<Array<{ name: string; domain: string }>>([]);
  const [settings, setSettings] = useState<PortalSettings | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', { cache: 'no-store' });
      const json = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setBrandForm({
        name: json.brand?.name ?? '',
        industry: json.brand?.industry ?? '',
        country: json.brand?.country ?? '',
        description: json.brand?.description ?? '',
        objective: json.brand?.objective ?? '',
        runSchedule: json.brand?.runSchedule ?? '',
      });
      setCompetitors(
        (json.competitors?.length
          ? json.competitors
          : json.shareOfVoice.comparison
              .filter((c) => c.type !== 'brand')
              .map((c) => ({ name: c.name, domain: null as string | null }))
        ).map((c) => ({ name: c.name, domain: c.domain ?? '' })),
      );
      setSettings(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveConfig(payload: {
    brand?: typeof brandForm;
    competitors?: Array<{ name: string; domain: string | null }>;
    settings?: PortalSettings;
  }) {
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const body: Record<string, unknown> = {};
      if (payload.brand) {
        body.brand = {
          name: payload.brand.name,
          industry: payload.brand.industry || null,
          country: payload.brand.country || null,
          description: payload.brand.description || null,
          objective: payload.brand.objective || null,
          runSchedule: payload.brand.runSchedule || null,
        };
      }
      if (payload.competitors) {
        body.competitors = payload.competitors
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name.trim(), domain: (c.domain ?? '').trim() || null }));
      }
      if (payload.settings) body.settings = payload.settings;

      const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaveMsg('Guardado');
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const score = data?.score.cleexsScore ?? data?.score.priaTotal;
  const sov = data?.shareOfVoice.percent;

  function renderSection(id: SectionId) {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando empliados.net…
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-900">
          No se pudo cargar: {error}
        </div>
      );
    }
    if (!data || !settings) return null;

    switch (id) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <SectionHeader
              title="Dashboard"
              subtitle={`Vista ejecutiva Empliados · score Cleexs + visibilidad en IA · ${fmtDate(data.score.updatedAt)}`}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                icon={<BarChart3 className="h-4 w-4" />}
                label="Cleexs Score"
                value={score != null ? String(score) : '—'}
                hint={data.score.source ? `Fuente: ${data.score.source}` : 'Sin score'}
                accent="text-indigo-600"
              />
              <Card
                icon={<Sparkles className="h-4 w-4" />}
                label="AI Share of Voice"
                value={sov != null ? `${sov}%` : '—'}
                hint={`${data.shareOfVoice.brandAppearances} / ${data.shareOfVoice.totalAppearances} apariciones`}
                accent="text-violet-600"
              />
              <Card
                icon={<Users className="h-4 w-4" />}
                label="Competidores"
                value={String(competitors.length || data.shareOfVoice.comparison.filter((c) => c.type !== 'brand').length)}
                hint="Set configurado"
                accent="text-sky-600"
              />
              <Card
                icon={<TrendingUp className="h-4 w-4" />}
                label="Mejor intención"
                value={
                  data.insights.intenciones.length
                    ? [...data.insights.intenciones].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
                        ?.intencion ?? '—'
                    : '—'
                }
                hint="Por score"
                accent="text-emerald-600"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Resumen ejecutivo">
                <p className="text-sm leading-relaxed text-slate-700">
                  {data.insights.resumenEjecutivo || 'Sin resumen en el diagnóstico.'}
                </p>
              </Panel>
              <Panel title="Próximas acciones Cleexs">
                <ul className="space-y-3 text-sm text-slate-700">
                  {(data.insights.sugerencias.length ? data.insights.sugerencias : ['Sin sugerencias']).map((s) => (
                    <li key={s} className="flex gap-3">
                      <Badge>SOV</Badge>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        );

      case 'funnel':
        return (
          <div className="space-y-6">
            <SectionHeader
              title="Funnel"
              subtitle="Pipeline de leads y contrataciones · últimos 30 días."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Visitas web', value: '18.4k', source: 'GA4' },
                { label: 'Leads', value: '642', source: 'CRM' },
                { label: 'Qualified', value: '218', source: 'CRM' },
                { label: 'Entrevistas', value: '97', source: 'ATS' },
                { label: 'Colocaciones', value: '34', source: 'ATS' },
              ].map((s) => (
                <Card key={s.label} icon={<Filter className="h-4 w-4" />} label={s.label} value={s.value} hint={s.source} />
              ))}
            </div>
            <Panel title="Conversión por etapa">
              <div className="space-y-3">
                {[
                  { from: 'Visita → Lead', rate: '3.5%' },
                  { from: 'Lead → Qualified', rate: '34%' },
                  { from: 'Qualified → Entrevista', rate: '44%' },
                  { from: 'Entrevista → Colocación', rate: '35%' },
                ].map((r) => (
                  <div key={r.from} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="text-slate-700">{r.from}</span>
                    <span className="font-semibold tabular-nums text-violet-700">{r.rate}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        );

      case 'clientes':
        return (
          <div className="space-y-6">
            <SectionHeader
              title="Clientes"
              subtitle="Empresas y contactos enriquecidos para secuencias y outreach."
            />
            <Panel title="Perfiles enriquecidos">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2 pr-4 font-semibold">Empresa</th>
                      <th className="pb-2 pr-4 font-semibold">Contacto</th>
                      <th className="pb-2 pr-4 font-semibold">WhatsApp</th>
                      <th className="pb-2 font-semibold">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {[
                      { co: 'Logística Andina SA', email: 'rrhh@logisticaandina.com', wa: '+54 9 11 5821…', tags: 'operarios, CABA' },
                      { co: 'TechNova Latam', email: 'talent@technova.io', wa: '+54 9 11 4470…', tags: 'IT, remoto' },
                      { co: 'Clínica del Sur', email: 'seleccion@clinicadelsur.com', wa: '+54 9 11 3902…', tags: 'salud, enfermería' },
                      { co: 'AgroPampa SRL', email: 'compras@agropampa.com', wa: '—', tags: 'campo, temporario' },
                    ].map((r) => (
                      <tr key={r.email}>
                        <td className="py-2.5 pr-4 font-medium">{r.co}</td>
                        <td className="py-2.5 pr-4">{r.email}</td>
                        <td className="py-2.5 pr-4">{r.wa}</td>
                        <td className="py-2.5 text-slate-500">{r.tags}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        );

      case 'referidos':
        return (
          <div className="space-y-6">
            <SectionHeader title="Referidos" subtitle="Link propio por contacto · atribución y beneficio." />
            <div className="grid gap-3 sm:grid-cols-3">
              <Card icon={<MousePointerClick className="h-4 w-4" />} label="Referidores activos" value="41" hint="Con al menos 1 click" accent="text-violet-600" />
              <Card icon={<Users className="h-4 w-4" />} label="Leads atribuidos" value="18" hint="Últimos 30 días" accent="text-emerald-600" />
              <Card icon={<Share2 className="h-4 w-4" />} label="Beneficio medio" value="15%" hint="Crédito en fee" accent="text-amber-600" />
            </div>
            <Panel title="Link activo">
              <code className="block rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
                https://empliados.net/?ref=carolina-ruiz-4c91
              </code>
            </Panel>
          </div>
        );

      case 'sov':
        return (
          <div className="space-y-6">
            <SectionHeader title="AI Share of Voice" subtitle="Comparativo del set competitivo en respuestas de IA." />
            <div className="grid gap-3 sm:grid-cols-3">
              <Card icon={<Sparkles className="h-4 w-4" />} label="SOV Empliados" value={sov != null ? `${sov}%` : '—'} accent="text-violet-600" />
              <Card
                icon={<Globe2 className="h-4 w-4" />}
                label="Apariciones"
                value={`${data.shareOfVoice.brandAppearances}`}
                hint={`de ${data.shareOfVoice.totalAppearances}`}
                accent="text-sky-600"
              />
              <Card icon={<BarChart3 className="h-4 w-4" />} label="Score" value={score != null ? String(score) : '—'} accent="text-indigo-600" />
            </div>
            <Panel title="Comparativo">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2 pr-4 font-semibold">Marca</th>
                      <th className="pb-2 pr-4 font-semibold">Tipo</th>
                      <th className="pb-2 pr-4 font-semibold">Share %</th>
                      <th className="pb-2 font-semibold">Apariciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.shareOfVoice.comparison.map((row) => (
                      <tr key={row.name} className={row.type === 'brand' ? 'bg-violet-50/50' : ''}>
                        <td className="py-2.5 pr-4 font-medium text-slate-900">{row.name}</td>
                        <td className="py-2.5 pr-4">
                          <Badge tone={row.type === 'brand' ? 'violet' : 'slate'}>{row.type}</Badge>
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">{row.share ?? '—'}%</td>
                        <td className="py-2.5 tabular-nums">{row.appearances ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Intenciones">
              <div className="space-y-3">
                {data.insights.intenciones.map((i) => (
                  <div key={i.intencion} className="rounded-xl border border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{i.intencion}</p>
                      <span className="text-lg font-bold tabular-nums text-violet-700">{i.score ?? '—'}</span>
                    </div>
                    {i.comentario ? <p className="mt-1 text-xs text-slate-600">{i.comentario}</p> : null}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        );

      case 'oportunidades':
        return (
          <div className="space-y-6">
            <SectionHeader title="Oportunidades" subtitle="Gaps donde Empliados puede ganar menciones en IA." />
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Debilidades">
                <ul className="space-y-2 text-sm text-slate-700">
                  {(data.insights.debilidades.length ? data.insights.debilidades : ['—']).map((d) => (
                    <li key={d} className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2">
                      {d}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Fortalezas">
                <ul className="space-y-2 text-sm text-slate-700">
                  {(data.insights.fortalezas.length ? data.insights.fortalezas : ['—']).map((d) => (
                    <li key={d} className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                      {d}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        );

      case 'contenido':
        return (
          <div className="space-y-6">
            <SectionHeader title="Contenido" subtitle="Páginas y FAQ orientadas a AEO para staffing." />
            <div className="grid gap-3 sm:grid-cols-3">
              <Card icon={<FileText className="h-4 w-4" />} label="Páginas publicadas" value="24" hint="CMS" accent="text-violet-600" />
              <Card icon={<Search className="h-4 w-4" />} label="Indexadas en IA" value="11" hint="Última corrida" accent="text-emerald-600" />
              <Card icon={<TrendingUp className="h-4 w-4" />} label="En progreso" value="5" hint="Borradores AEO" accent="text-amber-600" />
            </div>
            <Panel title="Prioridad editorial">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2 pr-4 font-semibold">Página</th>
                      <th className="pb-2 pr-4 font-semibold">Intención</th>
                      <th className="pb-2 pr-4 font-semibold">Estado</th>
                      <th className="pb-2 font-semibold">Hits SOV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {[
                      { page: 'Agencia de empleo temporal CABA', intent: 'Urgencia', status: 'Publicada', hits: 6 },
                      { page: 'Reclutamiento IT remoto Argentina', intent: 'Calidad', status: 'Publicada', hits: 4 },
                      { page: 'Cómo elegir una ETT vs Adecco', intent: 'Precio', status: 'En revisión', hits: 2 },
                      { page: 'FAQ · tiempos de colocación', intent: 'Urgencia', status: 'Borrador', hits: 0 },
                    ].map((r) => (
                      <tr key={r.page}>
                        <td className="py-2.5 pr-4 font-medium">{r.page}</td>
                        <td className="py-2.5 pr-4">{r.intent}</td>
                        <td className="py-2.5 pr-4">
                          <Badge tone={r.status === 'Publicada' ? 'emerald' : r.status === 'Borrador' ? 'slate' : 'amber'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 tabular-nums">{r.hits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        );

      case 'outreach':
        return (
          <div className="space-y-6">
            <SectionHeader title="Links & Outreach" subtitle="Fuentes donde aparecen rivales y Empliados aún no." />
            <div className="grid gap-3 sm:grid-cols-3">
              <Card icon={<Link2 className="h-4 w-4" />} label="Backlinks activos" value="38" hint="GSC + crawlers" accent="text-violet-600" />
              <Card icon={<Share2 className="h-4 w-4" />} label="Oportunidades" value="14" hint="Donde gana el rival" accent="text-amber-600" />
              <Card icon={<Mail className="h-4 w-4" />} label="Outreach enviados 7d" value="22" hint="Shadow / real" accent="text-sky-600" />
            </div>
            <Panel title="Fuentes prioritarias">
              <ul className="space-y-2 text-sm text-slate-700">
                {[
                  'guiadeempresas.com.ar — ficha Adecco / Randstad',
                  'bumeran.com · nota “mejores ETTs 2026”',
                  'linkedin.com/pulse — ranking staffing Latam',
                  'revista-rrhh.net — guía de proveedores',
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

      case 'auditoria':
        return (
          <div className="space-y-6">
            <SectionHeader title="Auditoría" subtitle="Técnica + agéntica Cleexs · indexación y acceso de bots." />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: 'robots.txt · GPTBot', ok: true },
                { name: 'sitemap.xml servicios', ok: true },
                { name: 'Schema Organization', ok: false },
                { name: 'FAQ indexables', ok: false },
                { name: 'Canonicals', ok: true },
                { name: 'Bloqueo de crawlers IA', ok: true },
              ].map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="text-sm text-slate-800">{c.name}</span>
                  <Badge tone={c.ok ? 'emerald' : 'amber'}>{c.ok ? 'OK' : 'Revisar'}</Badge>
                </div>
              ))}
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-6">
            <SectionHeader
              title="Email · secuencia"
              subtitle="Nurturing post-lead Empliados · personalizado por industria."
            />
            <Panel title="Pasos configurados" action={<Badge tone="emerald">3 activos</Badge>}>
              <div className="space-y-2">
                {[
                  { day: 0, subject: 'Gracias por tu consulta · tiempos de cobertura', active: true },
                  { day: 2, subject: 'Casos IT y operarios · cómo medimos SLA', active: true },
                  { day: 5, subject: 'Comparativa vs grandes ETTs en tu zona', active: true },
                  { day: 12, subject: 'Invitación a demo de portal de vacantes', active: false },
                ].map((s) => (
                  <div
                    key={s.day}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Día {s.day}</p>
                      <p className="text-sm text-slate-800">{s.subject}</p>
                    </div>
                    <Badge tone={s.active ? 'emerald' : 'slate'}>{s.active ? 'Activo' : 'Pausado'}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-5">
            <SectionHeader title="Settings" subtitle="Integraciones y configuración del portal de marca." />
            {(saveMsg || saveErr) && (
              <p className={`text-xs font-medium ${saveErr ? 'text-rose-600' : 'text-emerald-700'}`}>
                {saveErr || saveMsg}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['marca', 'Marca'],
                  ['competidores', 'Competidores'],
                  ['modulos', 'Módulos'],
                  ['integraciones', 'Integraciones'],
                  ['alertas', 'Alertas'],
                ] as Array<[SettingsTab, string]>
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSettingsTab(tab)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    settingsTab === tab ? 'bg-violet-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {settingsTab === 'marca' ? (
              <Panel title="Perfil de marca">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre">
                    <input className={inputCls} value={brandForm.name} onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label="Dominio" hint="Clave del portal">
                    <input className={inputCls} value={data.brand?.domain ?? data.domain} disabled />
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
                      <option value="">Sin programar</option>
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
                      <textarea className={`${inputCls} min-h-[96px]`} value={brandForm.description} onChange={(e) => setBrandForm((f) => ({ ...f, description: e.target.value }))} />
                    </Field>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={saving || !data.brand?.id}
                    onClick={() => void saveConfig({ brand: brandForm })}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar marca
                  </button>
                </div>
              </Panel>
            ) : null}

            {settingsTab === 'competidores' ? (
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
                    disabled={competitors.length >= 20}
                    onClick={() => setCompetitors((rows) => [...rows, { name: '', domain: '' }])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar rival
                  </button>
                  <button
                    type="button"
                    disabled={saving || !data.brand?.id}
                    onClick={() =>
                      void saveConfig({
                        competitors: competitors.map((c) => ({ name: c.name, domain: c.domain || null })),
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

            {settingsTab === 'modulos' ? (
              <Panel title="Módulos del portal">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['dashboard', 'Dashboard'],
                      ['sov', 'AI Share of Voice'],
                      ['oportunidades', 'Oportunidades'],
                      ['contenido', 'Contenido'],
                      ['outreach', 'Links & Outreach'],
                      ['auditoria', 'Auditoría'],
                      ['email', 'Email · secuencia'],
                      ['funnelEcommerce', 'Funnel e‑commerce'],
                    ] as Array<[keyof PortalSettings['modules'], string]>
                  ).map(([key, label]) => (
                    <Toggle
                      key={key}
                      checked={settings.modules[key]}
                      label={label}
                      onChange={(v) => setSettings((s) => (s ? { ...s, modules: { ...s.modules, [key]: v } } : s))}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Preferencias del portal por módulo.</p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={saving || !data.brand?.id}
                    onClick={() => void saveConfig({ settings })}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar
                  </button>
                </div>
              </Panel>
            ) : null}

            {settingsTab === 'integraciones' ? (
              <Panel title="Integraciones">
                <div className="space-y-2">
                  {(
                    [
                      ['wordpress', 'WordPress / CMS'],
                      ['ga4', 'Google Analytics 4'],
                      ['gsc', 'Google Search Console'],
                      ['shopify', 'Shopify'],
                      ['resend', 'Resend · email'],
                    ] as const
                  ).map(([key, label]) => (
                    <Toggle
                      key={key}
                      checked={
                        key === 'wordpress'
                          ? settings.integrations.wordpress.enabled
                          : settings.integrations[key].enabled
                      }
                      label={label}
                      onChange={(v) =>
                        setSettings((s) => {
                          if (!s) return s;
                          if (key === 'wordpress') {
                            return {
                              ...s,
                              integrations: {
                                ...s.integrations,
                                wordpress: { ...s.integrations.wordpress, enabled: v },
                              },
                            };
                          }
                          return {
                            ...s,
                            integrations: { ...s.integrations, [key]: { enabled: v } },
                          };
                        })
                      }
                    />
                  ))}
                </div>
                {settings.integrations.wordpress.enabled ? (
                  <div className="mt-3">
                    <Field label="URL WordPress">
                      <input
                        className={inputCls}
                        value={settings.integrations.wordpress.url}
                        onChange={(e) =>
                          setSettings((s) =>
                            s
                              ? {
                                  ...s,
                                  integrations: {
                                    ...s.integrations,
                                    wordpress: { ...s.integrations.wordpress, url: e.target.value },
                                  },
                                }
                              : s,
                          )
                        }
                      />
                    </Field>
                  </div>
                ) : null}
                <div className="mt-3">
                  <Field label="Notas">
                    <textarea
                      className={`${inputCls} min-h-[80px]`}
                      value={settings.notes}
                      onChange={(e) => setSettings((s) => (s ? { ...s, notes: e.target.value } : s))}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={saving || !data.brand?.id}
                    onClick={() => void saveConfig({ settings })}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar
                  </button>
                </div>
              </Panel>
            ) : null}

            {settingsTab === 'alertas' ? (
              <Panel title="Alertas y contacto">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre">
                    <input
                      className={inputCls}
                      value={settings.alerts.contactName}
                      onChange={(e) =>
                        setSettings((s) => (s ? { ...s, alerts: { ...s.alerts, contactName: e.target.value } } : s))
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      className={inputCls}
                      value={settings.alerts.contactEmail}
                      onChange={(e) =>
                        setSettings((s) => (s ? { ...s, alerts: { ...s.alerts, contactEmail: e.target.value } } : s))
                      }
                    />
                  </Field>
                </div>
                <div className="mt-3 grid gap-2">
                  <Toggle
                    checked={settings.alerts.scoreDrop}
                    label="Alerta por caída de score"
                    onChange={(v) => setSettings((s) => (s ? { ...s, alerts: { ...s.alerts, scoreDrop: v } } : s))}
                  />
                  <Toggle
                    checked={settings.alerts.weeklyDigest}
                    label="Digest semanal"
                    onChange={(v) => setSettings((s) => (s ? { ...s, alerts: { ...s.alerts, weeklyDigest: v } } : s))}
                  />
                  <Toggle
                    checked={settings.alerts.newOpportunity}
                    label="Nueva oportunidad"
                    onChange={(v) =>
                      setSettings((s) => (s ? { ...s, alerts: { ...s.alerts, newOpportunity: v } } : s))
                    }
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={saving || !data.brand?.id}
                    onClick={() => void saveConfig({ settings })}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar
                  </button>
                </div>
              </Panel>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  }

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
          <span className="ml-2 hidden rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200/80 sm:inline">
            Live
          </span>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xs font-medium text-slate-800">empliados.net</p>
          <p className="text-[10px] text-slate-500">Staffing / reclutamiento</p>
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

          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
            {renderSection(section)}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Cleexs · portal Empliados</p>
          <p className="font-medium text-violet-700">empliados.net</p>
        </div>
      </footer>
    </div>
  );
}
