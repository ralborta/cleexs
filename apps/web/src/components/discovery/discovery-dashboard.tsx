'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, Sparkles, TrendingUp, Youtube } from 'lucide-react';
import { YoutubeInterestChart } from '@/components/discovery/youtube-interest-chart';

export type KeywordOpportunity = {
  id: string;
  seedKeyword: string;
  keyword: string;
  cluster: string;
  priority: number;
  source: string;
  demandScore: number | null;
  monthlySearches?: number | null;
  trendScore?: number | null;
  opportunityScore?: number | null;
  brief?: Record<string, unknown> | null;
};

type YoutubeBrief = {
  interest?: number | null;
  trend?: string;
  interestGraph?: Array<{ dateFrom?: string | null; dateTo?: string | null; value?: number | null }>;
  relatedQueries?: Array<{ query: string; value: string; kind: 'top' | 'rising' }>;
  relatedTopics?: Array<{ title: string; value: string; kind: 'top' | 'rising' }>;
  topVideos?: Array<{
    title: string;
    videoId: string;
    url?: string | null;
    channelName?: string | null;
    views?: number | null;
  }>;
  topChannels?: Array<{
    name: string;
    videoCount: number;
    totalViews: number;
  }>;
};

type BriefShape = {
  channels?: Array<'google' | 'youtube'>;
  suggestedAngle?: string;
  relatedQueries?: string[];
  sources?: {
    google?: {
      monthlySearches?: number | null;
      demandScore?: number;
      trendLabel?: string;
    };
    youtube?: YoutubeBrief;
  };
};

type DiscoveryStatus = {
  configured: boolean;
  mode: 'sandbox' | 'live';
  settings: {
    siteUrl?: string;
    description?: string;
    market?: string;
    seeds?: string[];
  } | null;
  seeds: string[];
};

export type DiscoveryDashboardProps = {
  /** Workspace del Agente Cleexs (empleados | cleexs). */
  workspace?: string;
  apiBase?: string;
  fetcher?: (path: string, init?: RequestInit) => Promise<Response>;
};

function readBrief(row: KeywordOpportunity): BriefShape {
  return (row.brief && typeof row.brief === 'object' ? row.brief : {}) as BriefShape;
}

function formatViews(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

/** UI + función idénticas a Agente Cleexs /[workspace]/discovery (sin shell del Centro). */
export function DiscoveryDashboard({
  workspace = 'empleados',
  apiBase = '/api/borrador/portal-discovery',
  fetcher,
}: DiscoveryDashboardProps) {
  const [configured, setConfigured] = useState(false);
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [siteUrl, setSiteUrl] = useState(
    workspace === 'empleados' || workspace === 'empliados' ? 'https://empliados.net' : 'https://cleexs.net',
  );
  const [description, setDescription] = useState(
    workspace === 'empleados' || workspace === 'empliados'
      ? 'Agentes de IA orientados a logística: centros, flotas, warehouse y última milla'
      : 'Plataforma de visibilidad en IA / AEO para PyMEs',
  );
  const [seedsInput, setSeedsInput] = useState(
    workspace === 'empleados' || workspace === 'empliados'
      ? 'agentes de IA logística\nautomatización centros logísticos\nIA para flotas\nagentes autónomos warehouse'
      : 'visibilidad en IA\nAEO para pymes\nSEO para ChatGPT\nrecomendaciones en IA',
  );
  const [market, setMarket] = useState('latam');
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<KeywordOpportunity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const run = fetcher ?? ((path: string, init?: RequestInit) => fetch(path, { ...init, cache: 'no-store' }));
    try {
      const res = await run(`${apiBase}?workspace=${encodeURIComponent(workspace)}`);
      const data = (await res.json()) as {
        error?: string;
        status?: DiscoveryStatus;
        opportunities?: { opportunities?: KeywordOpportunity[] };
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar Discovery');
      const status = data.status;
      if (status) {
        setConfigured(Boolean(status.configured));
        setMode(status.mode);
        if (status.settings?.siteUrl) setSiteUrl(status.settings.siteUrl);
        if (status.settings?.description) setDescription(status.settings.description);
        if (status.settings?.market) setMarket(status.settings.market);
        if (Array.isArray(status.seeds) && status.seeds.length) {
          setSeedsInput(status.seeds.join('\n'));
        }
      }
      const discoveryRows = (data.opportunities?.opportunities ?? [])
        .filter((r) => r.source.startsWith('discovery_') || r.opportunityScore != null)
        .sort(
          (a, b) =>
            (b.opportunityScore ?? b.priority) - (a.opportunityScore ?? a.priority),
        )
        .slice(0, 40);
      setRecent(discoveryRows);
      setSelectedId((prev) => {
        if (prev && discoveryRows.some((r) => r.id === prev)) return prev;
        return discoveryRows[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar Discovery');
    } finally {
      setLoading(false);
    }
  }, [apiBase, fetcher, workspace]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExplore() {
    const seeds = seedsInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!seeds.length) {
      setError('Agregá al menos una keyword semilla.');
      return;
    }
    setRunning(true);
    setError(null);
    setMessage(null);
    const run = fetcher ?? ((path: string, init?: RequestInit) => fetch(path, { ...init, cache: 'no-store' }));
    try {
      const res = await run(`${apiBase}/explore?workspace=${encodeURIComponent(workspace)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: siteUrl.trim(),
          description: description.trim(),
          market,
          seeds,
          includeSiteKeywords: false,
          deepExpand: true,
          includeYoutube: true,
          youtubeMaxKeywords: 8,
          maxCandidates: 80,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        mode?: string;
        pool?: number;
        candidates?: number;
        briefs?: number;
        youtubeEnriched?: number;
        created?: number;
        updated?: number;
        cost?: number;
      };
      if (!res.ok) throw new Error(data.error || 'Error al explorar');
      setMessage(
        `Listo (${data.mode}): pool ${data.pool ?? '—'} → ${data.candidates} candidatos → ${data.briefs} briefs${
          typeof data.youtubeEnriched === 'number' ? ` · YT ${data.youtubeEnriched}` : ''
        } · +${data.created} / ~${data.updated} · cost≈$${(data.cost ?? 0).toFixed(4)}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al explorar');
    } finally {
      setRunning(false);
    }
  }

  const selected = useMemo(
    () => recent.find((r) => r.id === selectedId) ?? recent[0] ?? null,
    [recent, selectedId],
  );
  const selectedBrief = selected ? readBrief(selected) : null;
  const yt = selectedBrief?.sources?.youtube;

  const kpis = useMemo(() => {
    const withYt = recent.filter((r) => {
      const b = readBrief(r);
      return b.channels?.includes('youtube') || Boolean(b.sources?.youtube);
    }).length;
    const both = recent.filter((r) => {
      const ch = readBrief(r).channels ?? [];
      return ch.includes('google') && ch.includes('youtube');
    }).length;
    const interests = recent
      .map((r) => readBrief(r).sources?.youtube?.interest)
      .filter((v): v is number => typeof v === 'number');
    const avgInterest = interests.length
      ? Math.round(interests.reduce((a, b) => a + b, 0) / interests.length)
      : 0;
    return { total: recent.length, withYt, both, avgInterest };
  }, [recent]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600">
            Cleexs · Agente Discovery
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Discovery</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Señales Google + YouTube sobre tus topics. No publica: alimenta Oportunidades para Teo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Recargar
        </button>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        <strong>Estado:</strong>{' '}
        {configured
          ? `DataForSEO conectado · modo ${mode}`
          : 'Falta DATAFORSEO_LOGIN / PASSWORD en la API'}
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Oportunidades" value={kpis.total} hint="Discovery en cola" accent="text-violet-600" />
        <Kpi label="Con YouTube" value={kpis.withYt} hint="SERP o Trends YT" accent="text-orange-600" />
        <Kpi label="Google + YT" value={kpis.both} hint="Presencia en ambos" accent="text-teal-600" />
        <Kpi
          label="Interest YT medio"
          value={kpis.avgInterest}
          hint="Trends type=youtube (0–100)"
          accent="text-sky-600"
        />
      </div>

      <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-900">Explorar mercado</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-500">
            Sitio
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Mercado
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="latam">Latam (proxy Argentina)</option>
              <option value="ar">Argentina</option>
              <option value="mx">México</option>
              <option value="co">Colombia</option>
              <option value="es">España</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
            Descripción del negocio
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-500">
          Semillas / topics (una por línea)
          <textarea
            value={seedsInput}
            onChange={(e) => setSeedsInput(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Google (Ads + Labs) → score → YouTube SERP + Trends sobre el top 8. Puede tardar 1–3 min.
        </p>
        <button
          type="button"
          disabled={running || !configured}
          onClick={() => void handleExplore()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? 'Discovery corriendo…' : 'Correr Discovery'}
        </button>
      </section>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando dashboard…</p>
      ) : recent.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Todavía no hay oportunidades. Corré Discovery arriba.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Oportunidades</h3>
              <p className="text-xs text-slate-500">Elegí una para ver Google + YouTube</p>
            </div>
            <ul className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto">
              {recent.map((row) => {
                const brief = readBrief(row);
                const channels = brief.channels ?? ['google'];
                const active = row.id === selected?.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition',
                        active ? 'bg-violet-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-slate-900">{row.keyword}</p>
                        <p className="shrink-0 text-sm tabular-nums text-violet-700">
                          {row.opportunityScore ?? row.priority}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{row.cluster}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {channels.map((ch) => (
                          <span
                            key={ch}
                            className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600"
                          >
                            {ch === 'youtube' ? 'YouTube' : 'Google'}
                          </span>
                        ))}
                        {row.monthlySearches != null ? (
                          <span className="text-[10px] text-slate-400">vol {row.monthlySearches}</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="space-y-6">
            {selected ? (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Oportunidad seleccionada
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-900">{selected.keyword}</h3>
                      <p className="mt-1 text-sm text-slate-500">{selected.cluster}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tabular-nums text-violet-700">
                        {selected.opportunityScore ?? selected.priority}
                      </p>
                      <p className="text-xs text-slate-500">Opportunity score</p>
                    </div>
                  </div>
                  {selectedBrief?.suggestedAngle ? (
                    <p className="mt-4 text-sm text-slate-600">{selectedBrief.suggestedAngle}</p>
                  ) : null}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Google vol</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {selected.monthlySearches ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">YT interest</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{yt?.interest ?? '—'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">YT trend</p>
                      <p className="mt-1 text-lg font-semibold capitalize text-slate-900">
                        {yt?.trend ?? '—'}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Interés YouTube (12 meses)</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Google Trends · type=youtube · misma lectura que el Explore dashboard
                        </p>
                      </div>
                      <Youtube className="h-5 w-5 text-rose-500" />
                    </div>
                    <YoutubeInterestChart data={yt?.interestGraph ?? []} />
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Search className="h-4 w-4 text-sky-600" />
                      <h3 className="text-sm font-semibold text-slate-900">Google (brief)</h3>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>
                        Demanda {selected.demandScore ?? '—'} · Tendencia{' '}
                        {selectedBrief?.sources?.google?.trendLabel ?? selected.trendScore ?? '—'}
                      </p>
                      {(selectedBrief?.relatedQueries ?? []).length > 0 ? (
                        <ul className="space-y-1.5">
                          {selectedBrief!.relatedQueries!.slice(0, 8).map((q) => (
                            <li
                              key={q}
                              className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                            >
                              {q}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">Sin related queries en el brief.</p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-rose-500" />
                      <h3 className="text-sm font-semibold text-slate-900">Related queries (YouTube)</h3>
                    </div>
                    {!yt ? (
                      <p className="text-sm text-slate-500">
                        Sin datos YouTube. Corré Discovery de nuevo (corridas viejas no lo tienen).
                      </p>
                    ) : (yt.relatedQueries ?? []).length ? (
                      <ul className="space-y-1.5">
                        {yt.relatedQueries!.slice(0, 12).map((q) => (
                          <li
                            key={`${q.kind}-${q.query}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-700">{q.query}</span>
                            <span className="shrink-0 text-slate-400">
                              {q.kind} · {q.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">Sin related queries YT.</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-rose-500" />
                      <h3 className="text-sm font-semibold text-slate-900">Related topics (YouTube)</h3>
                    </div>
                    {!yt ? (
                      <p className="text-sm text-slate-500">Sin datos YouTube todavía.</p>
                    ) : (yt.relatedTopics ?? []).length ? (
                      <ul className="space-y-1.5">
                        {yt.relatedTopics!.slice(0, 12).map((t) => (
                          <li
                            key={`${t.kind}-${t.title}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-700">{t.title}</span>
                            <span className="shrink-0 text-slate-400">
                              {t.kind} · {t.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">Sin related topics YT para esta keyword.</p>
                    )}
                  </section>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-rose-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Top videos YouTube (SERP)</h3>
                  </div>
                  {!yt?.topVideos?.length ? (
                    <p className="text-sm text-slate-500">Sin videos en SERP para esta keyword.</p>
                  ) : (
                    <div className="space-y-3">
                      {yt.topVideos.slice(0, 8).map((v, index) => (
                        <div
                          key={v.videoId || `${v.title}-${index}`}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900">{v.title}</p>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span>{v.channelName || 'Canal —'}</span>
                                <span>{formatViews(v.views)} views</span>
                              </div>
                            </div>
                            {v.url || v.videoId ? (
                              <a
                                href={v.url || `https://www.youtube.com/watch?v=${v.videoId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-xs font-semibold text-sky-600 hover:underline"
                              >
                                Ver →
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {yt?.topChannels?.length ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Canales que aparecen</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {yt.topChannels.slice(0, 6).map((ch) => (
                        <div key={ch.name} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-sm font-medium text-slate-900">{ch.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {ch.videoCount} videos en SERP · {formatViews(ch.totalViews)} views acum.
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
