'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

type Snapshot = {
  ok: boolean;
  domain: string;
  brand: { id: string | null; name: string; domain: string; industry: string | null } | null;
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
  modules: Record<string, boolean>;
};

const NAV: Array<{ id: SectionId; label: string; icon: typeof Mail; group: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, group: 'Negocio' },
  { id: 'sov', label: 'AI Share of Voice', icon: Sparkles, group: 'Visibilidad IA' },
  { id: 'oportunidades', label: 'Oportunidades', icon: Search, group: 'Visibilidad IA' },
  { id: 'contenido', label: 'Contenido AEO', icon: FileText, group: 'Visibilidad IA' },
  { id: 'outreach', label: 'Links & Outreach', icon: Link2, group: 'Visibilidad IA' },
  { id: 'auditoria', label: 'Auditoría', icon: ScanSearch, group: 'Visibilidad IA' },
  { id: 'email', label: 'Email · Cleexs', icon: Mail, group: 'Crecimiento' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Crecimiento' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'emerald' | 'amber' | 'slate' | 'rose' }) {
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

export function PortalEmpliadosDraft() {
  const [section, setSection] = useState<SectionId>('dashboard');
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', { cache: 'no-store' });
        const json = (await res.json()) as Snapshot & { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, typeof NAV>();
    for (const item of NAV) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, []);

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
          <Badge tone="emerald">Datos reales Cleexs</Badge>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xs font-medium text-slate-800">empliados.net</p>
          <p className="text-[10px] text-slate-500">Staffing / reclutamiento</p>
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
            {NAV.map(({ id, label, icon: Icon }) => {
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
              <strong className="font-semibold">Portal real · Empliados</strong> — score, SOV y insights vienen de
              Cleexs (`Brand` + diagnóstico). Módulos e‑commerce quedan como placeholder hasta integrar.
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando datos de empliados.net…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-900">
                No se pudo cargar el snapshot: {error}
                <p className="mt-2 text-xs text-rose-700">
                  Si ves 503, redeployá API (endpoint `/api/admin/brand-portal/:domain`) y web.
                </p>
              </div>
            ) : data ? (
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
                        label="Rivales en set"
                        value={String(data.shareOfVoice.comparison.filter((c) => c.type !== 'brand').length)}
                        hint="Del último diagnóstico"
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
                      Placeholder: páginas profundas / FAQ para IA. En Empliados se cablearía CMS o generación de
                      contenido por intención (Calidad 0, Urgencia 33, Precio 67).
                    </MockNote>
                  </div>
                ) : null}

                {section === 'outreach' ? (
                  <div className="space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900">Links & Outreach</h1>
                    <MockNote>
                      Placeholder: outreach Cleexs a fuentes donde ganan Adecco / Randstad. El motor de outreach ya
                      existe en admin Cleexs; falta scope por marca.
                    </MockNote>
                  </div>
                ) : null}

                {section === 'auditoria' ? (
                  <div className="space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900">Auditoría</h1>
                    <MockNote>
                      Placeholder: auditoría agéntica / AEO del sitio empliados.net (robots, schema, indexación).
                      Herramientas ya viven en admin Cleexs.
                    </MockNote>
                  </div>
                ) : null}

                {section === 'email' ? (
                  <div className="space-y-4">
                    <h1 className="text-2xl font-semibold text-slate-900">Email</h1>
                    <MockNote>
                      La secuencia free de Cleexs es del producto Cleexs (post-diagnóstico), no una secuencia de
                      Empliados. Acá iría una secuencia de marca si el cliente la contrata.
                    </MockNote>
                  </div>
                ) : null}

                {section === 'settings' ? (
                  <div className="space-y-6">
                    <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
                    <Panel title="Marca conectada" action={<Badge tone="emerald">Real</Badge>}>
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase text-slate-400">Nombre</dt>
                          <dd className="font-medium text-slate-900">{data.brand?.name ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-slate-400">Dominio</dt>
                          <dd className="font-medium text-slate-900">{data.brand?.domain ?? data.domain}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-slate-400">Industry</dt>
                          <dd className="font-medium text-slate-900">{data.brand?.industry ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-slate-400">Diagnostic ID</dt>
                          <dd className="font-mono text-xs text-slate-700">{data.score.diagnosticId ?? '—'}</dd>
                        </div>
                      </dl>
                    </Panel>
                    <MockNote>Shopify / GA4 / GSC: no aplican aún a este demo (B2B staffing).</MockNote>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl text-xs text-slate-500 sm:justify-between">
          <p>Cleexs · portal de marca Empliados (borrador funcional).</p>
          <p className="font-medium text-violet-700">/borrador/portal-empliados</p>
        </div>
      </footer>
    </div>
  );
}
