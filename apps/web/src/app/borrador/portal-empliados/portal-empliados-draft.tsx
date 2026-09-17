'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  FileText,
  Globe2,
  Link2,
  Loader2,
  Mail,
  ScanSearch,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

type SectionId =
  | 'dashboard'
  | 'sov'
  | 'oportunidades'
  | 'contenido'
  | 'outreach'
  | 'email'
  | 'auditoria'
  | 'settings';

type SettingsTab = 'marca' | 'competidores' | 'modulos' | 'integraciones' | 'alertas';

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

type CompetitorRow = {
  id?: string;
  name: string;
  domain: string | null;
  validated?: boolean;
  autoDetected?: boolean;
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
  competitors: CompetitorRow[];
  aliases: Array<{ id: string; alias: string }>;
  settings: PortalSettings;
  score: {
    cleexsScore: number | null;
    priaTotal: number | null;
    source: string | null;
    updatedAt: string | null;
    diagnosticId: string | null;
    shareSlug: string | null;
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

const NAV: Array<{ id: SectionId; label: string; icon: typeof Mail; group: string; moduleKey?: keyof PortalSettings['modules'] }> = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, group: 'Negocio', moduleKey: 'dashboard' },
  { id: 'sov', label: 'AI Share of Voice', icon: Sparkles, group: 'Visibilidad IA', moduleKey: 'sov' },
  { id: 'oportunidades', label: 'Oportunidades', icon: Search, group: 'Visibilidad IA', moduleKey: 'oportunidades' },
  { id: 'contenido', label: 'Contenido AEO', icon: FileText, group: 'Visibilidad IA', moduleKey: 'contenido' },
  { id: 'outreach', label: 'Links & Outreach', icon: Link2, group: 'Visibilidad IA', moduleKey: 'outreach' },
  { id: 'auditoria', label: 'Auditoría', icon: ScanSearch, group: 'Visibilidad IA', moduleKey: 'auditoria' },
  { id: 'email', label: 'Email · Cleexs', icon: Mail, group: 'Crecimiento', moduleKey: 'email' },
  { id: 'settings', label: 'Configuración', icon: Settings, group: 'Crecimiento' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
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

function MockNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-200 focus:ring-2';

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
      <span
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${
          checked ? 'bg-violet-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
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
              .map((c) => ({ name: c.name, domain: null }))
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

  const visibleNav = useMemo(() => {
    return NAV.filter((item) => {
      if (!item.moduleKey || !settings) return true;
      return settings.modules[item.moduleKey];
    });
  }, [settings]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof NAV>();
    for (const item of visibleNav) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [visibleNav]);

  useEffect(() => {
    if (section !== 'settings' && !visibleNav.some((n) => n.id === section)) {
      setSection('dashboard');
    }
  }, [section, visibleNav]);

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
          .map((c) => ({ name: c.name.trim(), domain: c.domain.trim() || null }));
      }
      if (payload.settings) body.settings = payload.settings;

      const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaveMsg('Guardado en Cleexs');
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const brandName = data?.brand?.name ?? 'Empliados';
  const score = data?.score.cleexsScore ?? data?.score.priaTotal;
  const sov = data?.shareOfVoice.percent;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
            C
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">Cleexs · portal marca</p>
            <p className="text-sm font-semibold text-slate-900">{brandName}</p>
          </div>
          <Badge tone="emerald">Datos + config reales</Badge>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSection('settings')}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar
          </button>
          <div className="text-right leading-tight">
            <p className="text-xs font-medium text-slate-800">empliados.net</p>
            <p className="text-[10px] text-slate-500">Staffing / reclutamiento</p>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white py-6 md:block">
          <nav className="flex flex-col gap-5 px-3">
            {groups.map(([title, links]) => (
              <div key={title} className="flex flex-col gap-0.5">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
                {links.map(({ id, label, icon: Icon }) => {
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
            {visibleNav.map(({ id, label, icon: Icon }) => {
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
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-8 md:py-10">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
              <strong className="font-semibold">Portal real · Empliados</strong> — métricas del diagnóstico +{' '}
              <button type="button" className="font-semibold underline" onClick={() => setSection('settings')}>
                configuración editable
              </button>{' '}
              (marca, competidores, módulos, alertas) guardada en Cleexs.
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando datos de empliados.net…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-900">
                No se pudo cargar el snapshot: {error}
              </div>
            ) : data && settings ? (
              <>
                {section === 'dashboard' ? (
                  <div className="space-y-6">
                    <header>
                      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
                      <p className="mt-1 text-sm text-slate-600">
                        Visibilidad en IA de {brandName} · actualizado {fmtDate(data.score.updatedAt)}
                      </p>
                    </header>
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
                        label="Competidores config."
                        value={String(competitors.length)}
                        hint="Editables en Configuración"
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
                        hint="Por score de intención"
                        accent="text-emerald-600"
                      />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Panel title="Resumen ejecutivo" action={<Badge>Real</Badge>}>
                        <p className="text-sm leading-relaxed text-slate-700">
                          {data.insights.resumenEjecutivo || 'Sin resumen en el diagnóstico.'}
                        </p>
                      </Panel>
                      <Panel title="Próximas acciones" action={<Badge tone="emerald">Real</Badge>}>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {(data.insights.sugerencias.length
                            ? data.insights.sugerencias
                            : ['Sin sugerencias en el reporte.']
                          ).map((s) => (
                            <li key={s} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    </div>
                  </div>
                ) : null}

                {section === 'sov' ? (
                  <div className="space-y-6">
                    <header>
                      <h1 className="text-2xl font-semibold text-slate-900">AI Share of Voice</h1>
                      <p className="mt-1 text-sm text-slate-600">Comparativo del set competitivo en respuestas de IA.</p>
                    </header>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Card
                        icon={<Sparkles className="h-4 w-4" />}
                        label="SOV Empliados"
                        value={sov != null ? `${sov}%` : '—'}
                        accent="text-violet-600"
                      />
                      <Card
                        icon={<Globe2 className="h-4 w-4" />}
                        label="Apariciones"
                        value={`${data.shareOfVoice.brandAppearances}`}
                        hint={`de ${data.shareOfVoice.totalAppearances} en el set`}
                        accent="text-sky-600"
                      />
                      <Card
                        icon={<BarChart3 className="h-4 w-4" />}
                        label="Score"
                        value={score != null ? String(score) : '—'}
                        accent="text-indigo-600"
                      />
                    </div>
                    <Panel title="Comparativo" action={<Badge>Real · Cleexs</Badge>}>
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
                    <Panel title="Intenciones" action={<Badge>Real</Badge>}>
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
                ) : null}

                {section === 'oportunidades' ? (
                  <div className="space-y-6">
                    <header>
                      <h1 className="text-2xl font-semibold text-slate-900">Oportunidades</h1>
                      <p className="mt-1 text-sm text-slate-600">Derivadas del diagnóstico (debilidades + sugerencias).</p>
                    </header>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Panel title="Debilidades" action={<Badge tone="rose">Real</Badge>}>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {(data.insights.debilidades.length ? data.insights.debilidades : ['—']).map((d) => (
                            <li key={d} className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2">
                              {d}
                            </li>
                          ))}
                        </ul>
                      </Panel>
                      <Panel title="Fortalezas" action={<Badge tone="emerald">Real</Badge>}>
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
                ) : null}

                {section === 'contenido' ? (
                  <div className="space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900">Contenido AEO</h1>
                    <MockNote>
                      Placeholder operativo: se puede desactivar desde Configuración → Módulos hasta cablear CMS /
                      generación por intención.
                    </MockNote>
                  </div>
                ) : null}

                {section === 'outreach' ? (
                  <div className="space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900">Links & Outreach</h1>
                    <MockNote>Placeholder: outreach por marca. Activá/desactivá el módulo en Configuración.</MockNote>
                  </div>
                ) : null}

                {section === 'auditoria' ? (
                  <div className="space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900">Auditoría</h1>
                    <MockNote>Placeholder: auditorías AEO/agénticas del sitio. Configurable en módulos.</MockNote>
                  </div>
                ) : null}

                {section === 'email' ? (
                  <div className="space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900">Email</h1>
                    <MockNote>
                      Módulo de email de marca (no la secuencia free de Cleexs). Contacto de alertas en Configuración →
                      Alertas.
                    </MockNote>
                  </div>
                ) : null}

                {section === 'settings' ? (
                  <div className="space-y-5">
                    <header className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
                        <p className="mt-1 text-sm text-slate-600">
                          Todo lo que el cliente debería poder ajustar en su portal de marca.
                        </p>
                      </div>
                      {(saveMsg || saveErr) && (
                        <p className={`text-xs font-medium ${saveErr ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {saveErr || saveMsg}
                        </p>
                      )}
                    </header>

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['marca', 'Marca'],
                          ['competidores', 'Competidores'],
                          ['modulos', 'Módulos'],
                          ['integraciones', 'Integraciones'],
                          ['alertas', 'Alertas'],
                        ] as Array<[SettingsTab, string]>
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSettingsTab(id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            settingsTab === id
                              ? 'bg-violet-600 text-white'
                              : 'bg-white text-slate-700 ring-1 ring-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {settingsTab === 'marca' ? (
                      <Panel title="Perfil de marca" action={<Badge tone="emerald">Persiste en Brand</Badge>}>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Nombre">
                            <input
                              className={inputCls}
                              value={brandForm.name}
                              onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))}
                            />
                          </Field>
                          <Field label="Dominio" hint="No editable acá (clave del portal)">
                            <input className={inputCls} value={data.brand?.domain ?? data.domain} disabled />
                          </Field>
                          <Field label="Industria">
                            <input
                              className={inputCls}
                              value={brandForm.industry}
                              onChange={(e) => setBrandForm((f) => ({ ...f, industry: e.target.value }))}
                            />
                          </Field>
                          <Field label="País">
                            <input
                              className={inputCls}
                              value={brandForm.country}
                              onChange={(e) => setBrandForm((f) => ({ ...f, country: e.target.value }))}
                            />
                          </Field>
                          <Field label="Frecuencia de corridas">
                            <select
                              className={inputCls}
                              value={brandForm.runSchedule}
                              onChange={(e) =>
                                setBrandForm((f) => ({
                                  ...f,
                                  runSchedule: e.target.value as typeof brandForm.runSchedule,
                                }))
                              }
                            >
                              <option value="">Sin programar</option>
                              <option value="semanal">Semanal</option>
                              <option value="quincenal">Quincenal</option>
                              <option value="mensual">Mensual</option>
                            </select>
                          </Field>
                          <Field label="Objetivo">
                            <input
                              className={inputCls}
                              value={brandForm.objective}
                              onChange={(e) => setBrandForm((f) => ({ ...f, objective: e.target.value }))}
                              placeholder="Ej. ganar share vs Adecco en IA"
                            />
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
                            disabled={saving || !data.brand?.id}
                            onClick={() => void saveConfig({ brand: brandForm })}
                            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar marca
                          </button>
                        </div>
                        {!data.brand?.id ? (
                          <p className="mt-2 text-xs text-amber-700">Falta Brand en Cleexs para este dominio.</p>
                        ) : null}
                      </Panel>
                    ) : null}

                    {settingsTab === 'competidores' ? (
                      <Panel
                        title="Set competitivo"
                        action={<Badge tone="emerald">Persiste en Competitor</Badge>}
                      >
                        <p className="mb-3 text-xs text-slate-500">
                          Estos rivales alimentan corridas y el foco del portal. Máx. 20.
                        </p>
                        <div className="space-y-2">
                          {competitors.map((c, idx) => (
                            <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                className={inputCls}
                                placeholder="Nombre"
                                value={c.name}
                                onChange={(e) =>
                                  setCompetitors((rows) =>
                                    rows.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                                  )
                                }
                              />
                              <input
                                className={inputCls}
                                placeholder="dominio.com (opcional)"
                                value={c.domain}
                                onChange={(e) =>
                                  setCompetitors((rows) =>
                                    rows.map((r, i) => (i === idx ? { ...r, domain: e.target.value } : r)),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => setCompetitors((rows) => rows.filter((_, i) => i !== idx))}
                                aria-label="Quitar"
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar rival
                          </button>
                          <button
                            type="button"
                            disabled={saving || !data.brand?.id}
                            onClick={() =>
                              void saveConfig({
                                competitors: competitors.map((c) => ({
                                  name: c.name,
                                  domain: c.domain || null,
                                })),
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
                      <Panel title="Módulos del portal" action={<Badge>portal_settings</Badge>}>
                        <p className="mb-3 text-xs text-slate-500">
                          Lo que apagues desaparece del menú lateral (salvo Configuración).
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(
                            [
                              ['dashboard', 'Dashboard', 'Score + resumen'],
                              ['sov', 'AI Share of Voice', 'Comparativo e intenciones'],
                              ['oportunidades', 'Oportunidades', 'Debilidades y fortalezas'],
                              ['contenido', 'Contenido AEO', 'CMS / FAQs'],
                              ['outreach', 'Links & Outreach', 'Backlinks y outreach'],
                              ['auditoria', 'Auditoría', 'AEO / agéntica'],
                              ['email', 'Email de marca', 'Secuencias del cliente'],
                              ['funnelEcommerce', 'Funnel e‑commerce', 'Shopify / GA4'],
                            ] as Array<[keyof PortalSettings['modules'], string, string]>
                          ).map(([key, label, hint]) => (
                            <Toggle
                              key={key}
                              checked={settings.modules[key]}
                              label={label}
                              hint={hint}
                              onChange={(v) =>
                                setSettings((s) => (s ? { ...s, modules: { ...s.modules, [key]: v } } : s))
                              }
                            />
                          ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={saving || !data.brand?.id}
                            onClick={() => void saveConfig({ settings })}
                            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar módulos
                          </button>
                        </div>
                      </Panel>
                    ) : null}

                    {settingsTab === 'integraciones' ? (
                      <Panel title="Integraciones" action={<Badge>Preferencias</Badge>}>
                        <div className="space-y-2">
                          <Toggle
                            checked={settings.integrations.wordpress.enabled}
                            label="WordPress / CMS"
                            hint="Sitio de contenido AEO"
                            onChange={(v) =>
                              setSettings((s) =>
                                s
                                  ? {
                                      ...s,
                                      integrations: {
                                        ...s.integrations,
                                        wordpress: { ...s.integrations.wordpress, enabled: v },
                                      },
                                    }
                                  : s,
                              )
                            }
                          />
                          {settings.integrations.wordpress.enabled ? (
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
                                            wordpress: {
                                              ...s.integrations.wordpress,
                                              url: e.target.value,
                                            },
                                          },
                                        }
                                      : s,
                                  )
                                }
                                placeholder="https://empliados.net"
                              />
                            </Field>
                          ) : null}
                          <Toggle
                            checked={settings.integrations.ga4.enabled}
                            label="Google Analytics 4"
                            onChange={(v) =>
                              setSettings((s) =>
                                s
                                  ? {
                                      ...s,
                                      integrations: {
                                        ...s.integrations,
                                        ga4: { enabled: v },
                                      },
                                    }
                                  : s,
                              )
                            }
                          />
                          <Toggle
                            checked={settings.integrations.gsc.enabled}
                            label="Google Search Console"
                            onChange={(v) =>
                              setSettings((s) =>
                                s
                                  ? {
                                      ...s,
                                      integrations: {
                                        ...s.integrations,
                                        gsc: { enabled: v },
                                      },
                                    }
                                  : s,
                              )
                            }
                          />
                          <Toggle
                            checked={settings.integrations.shopify.enabled}
                            label="Shopify"
                            hint="No aplica a staffing; queda apagado por defecto"
                            onChange={(v) =>
                              setSettings((s) =>
                                s
                                  ? {
                                      ...s,
                                      integrations: {
                                        ...s.integrations,
                                        shopify: { enabled: v },
                                      },
                                    }
                                  : s,
                              )
                            }
                          />
                          <Toggle
                            checked={settings.integrations.resend.enabled}
                            label="Resend · email transaccional"
                            onChange={(v) =>
                              setSettings((s) =>
                                s
                                  ? {
                                      ...s,
                                      integrations: {
                                        ...s.integrations,
                                        resend: { enabled: v },
                                      },
                                    }
                                  : s,
                              )
                            }
                          />
                        </div>
                        <Field label="Notas internas">
                          <textarea
                            className={`${inputCls} mt-3 min-h-[80px]`}
                            value={settings.notes}
                            onChange={(e) => setSettings((s) => (s ? { ...s, notes: e.target.value } : s))}
                            placeholder="Notas del onboarding / acuerdos con el cliente"
                          />
                        </Field>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={saving || !data.brand?.id}
                            onClick={() => void saveConfig({ settings })}
                            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar integraciones
                          </button>
                        </div>
                      </Panel>
                    ) : null}

                    {settingsTab === 'alertas' ? (
                      <Panel title="Alertas y contacto" action={<Badge>portal_settings</Badge>}>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Nombre de contacto">
                            <input
                              className={inputCls}
                              value={settings.alerts.contactName}
                              onChange={(e) =>
                                setSettings((s) =>
                                  s
                                    ? { ...s, alerts: { ...s.alerts, contactName: e.target.value } }
                                    : s,
                                )
                              }
                            />
                          </Field>
                          <Field label="Email de alertas">
                            <input
                              type="email"
                              className={inputCls}
                              value={settings.alerts.contactEmail}
                              onChange={(e) =>
                                setSettings((s) =>
                                  s
                                    ? { ...s, alerts: { ...s.alerts, contactEmail: e.target.value } }
                                    : s,
                                )
                              }
                              placeholder="ops@empliados.net"
                            />
                          </Field>
                        </div>
                        <div className="mt-3 grid gap-2">
                          <Toggle
                            checked={settings.alerts.scoreDrop}
                            label="Alerta por caída de score"
                            onChange={(v) =>
                              setSettings((s) =>
                                s ? { ...s, alerts: { ...s.alerts, scoreDrop: v } } : s,
                              )
                            }
                          />
                          <Toggle
                            checked={settings.alerts.weeklyDigest}
                            label="Digest semanal"
                            onChange={(v) =>
                              setSettings((s) =>
                                s ? { ...s, alerts: { ...s.alerts, weeklyDigest: v } } : s,
                              )
                            }
                          />
                          <Toggle
                            checked={settings.alerts.newOpportunity}
                            label="Nueva oportunidad detectada"
                            onChange={(v) =>
                              setSettings((s) =>
                                s ? { ...s, alerts: { ...s.alerts, newOpportunity: v } } : s,
                              )
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
                            Guardar alertas
                          </button>
                        </div>
                      </Panel>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl text-xs text-slate-500 sm:justify-between">
          <p>Cleexs · portal Empliados (métricas + configuración).</p>
          <p className="font-medium text-violet-700">/borrador/portal-empliados</p>
        </div>
      </footer>
    </div>
  );
}
