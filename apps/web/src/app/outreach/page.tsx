'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  brandsApi,
  leadsApi,
  tenantsApi,
  type Brand,
  type LeadContact,
  type LeadSource,
} from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Globe, Mail, Search, Sparkles, Users } from 'lucide-react';

function contactsBySource(contacts: LeadContact[]): Record<string, LeadContact[]> {
  const map: Record<string, LeadContact[]> = {};
  for (const c of contacts || []) {
    const key = (c.source || 'otro').toLowerCase();
    if (!map[key]) map[key] = [];
    map[key].push(c);
  }
  return map;
}

function SourceColumn({
  title,
  subtitle,
  accent,
  contacts,
}: {
  title: string;
  subtitle: string;
  accent: 'blue' | 'purple';
  contacts: LeadContact[];
}) {
  const accentStyles =
    accent === 'blue'
      ? {
          border: 'border-blue-200',
          bg: 'bg-blue-50/40',
          title: 'text-blue-700',
          badge: 'bg-blue-100 text-blue-700',
        }
      : {
          border: 'border-purple-200',
          bg: 'bg-purple-50/40',
          title: 'text-purple-700',
          badge: 'bg-purple-100 text-purple-700',
        };

  return (
    <div className={`rounded-xl border ${accentStyles.border} ${accentStyles.bg} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold ${accentStyles.title}`}>{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${accentStyles.badge}`}
        >
          <Users className="h-3 w-3" />
          {contacts.length}
        </span>
      </div>
      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-center text-xs text-slate-500">
          Sin contactos devueltos por esta herramienta todavía.
        </p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-slate-800">{c.email}</span>
                {c.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    verificado
                  </span>
                )}
              </div>
              {(c.name || c.role) && (
                <p className="mt-1 text-xs text-slate-600">
                  {c.name && <span className="font-medium">{c.name}</span>}
                  {c.name && c.role && <span className="text-slate-400"> · </span>}
                  {c.role && <span>{c.role}</span>}
                </p>
              )}
              {typeof c.score === 'number' && c.score > 0 && (
                <p className="mt-1 text-xs text-slate-500">Confianza: {c.score}%</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadSource }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const bySource = contactsBySource(lead.contacts || []);
  const firecrawl = bySource['firecrawl'] || [];
  const hunter = bySource['hunter'] || [];
  const total = (lead.contacts || []).length;
  const evidence = lead.evidenceJson as
    | {
        promptText?: string;
        top3?: Array<{ position: number; name: string }>;
        brandPosition?: number | null;
        competitorPosition?: number;
      }
    | undefined;

  return (
    <Card className="border-transparent bg-white shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Sparkles className="h-4 w-4 text-primary-600" />
              {lead.competitorName}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {lead.competitorDomain && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                  <Globe className="h-3 w-3" />
                  {lead.competitorDomain}
                </span>
              )}
              {evidence?.competitorPosition && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                  Rankea #{evidence.competitorPosition}
                </span>
              )}
              {evidence?.brandPosition != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                  Tu marca #{evidence.brandPosition}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">
                <Mail className="h-3 w-3" />
                {total} contactos
              </span>
            </CardDescription>
          </div>
          {evidence?.promptText && (
            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              className="self-start text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              {showEvidence ? 'Ocultar evidencia' : 'Ver evidencia'}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showEvidence && evidence && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-800">Prompt detectado</p>
            <p className="mt-1 italic">&ldquo;{evidence.promptText}&rdquo;</p>
            {Array.isArray(evidence.top3) && evidence.top3.length > 0 && (
              <>
                <p className="mt-2 font-semibold text-slate-800">Top 3 devuelto</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                  {evidence.top3.map((entry) => (
                    <li key={`${entry.position}-${entry.name}`}>{entry.name}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <SourceColumn
            title="Firecrawl"
            subtitle="Emails extraídos de la web del competidor"
            accent="blue"
            contacts={firecrawl}
          />
          <SourceColumn
            title="Hunter.io"
            subtitle="Domain search con nombre y rol"
            accent="purple"
            contacts={hunter}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function pickDefaultBrandId(brands: Brand[], leads: LeadSource[]): string {
  // 1) Si hay leads, preferimos la marca del lead mas reciente (el diagnostico
  //    recien completado ya genero LeadSources para esa marca).
  const sortedLeads = [...leads].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });
  for (const lead of sortedLeads) {
    if (lead.brandId && brands.some((b) => b.id === lead.brandId)) {
      return lead.brandId;
    }
  }
  // 2) Si no hay leads todavia, usamos la primera marca (el backend las ordena desc).
  return brands[0]?.id || '';
}

export default function OutreachPage() {
  const [tenantId, setTenantId] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [userPickedBrand, setUserPickedBrand] = useState(false);
  const [leads, setLeads] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<null | 'discover' | 'enrich' | 'refresh'>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tenant = await tenantsApi.getByCode('000');
        if (cancelled) return;
        setTenantId(tenant.id);
        const [brandList, leadList] = await Promise.all([
          brandsApi.list(tenant.id),
          leadsApi.list(tenant.id),
        ]);
        if (cancelled) return;
        setBrands(brandList);
        setLeads(leadList);
        setSelectedBrandId(pickDefaultBrandId(brandList, leadList));
      } catch (err) {
        if (!cancelled) {
          setNotice({
            kind: 'err',
            text: err instanceof Error ? err.message : 'Error cargando datos iniciales.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-polling: cada 8s durante 2 minutos refresca leads por si el outreach
  // automatico del diagnostico recien disparado aun esta en curso en el backend.
  useEffect(() => {
    if (!tenantId) return;
    let elapsed = 0;
    const maxMs = 120_000;
    const intervalMs = 8_000;
    setAutoRefreshing(true);
    const interval = setInterval(async () => {
      elapsed += intervalMs;
      try {
        const leadList = await leadsApi.list(tenantId);
        setLeads((prev) => {
          // Si llegan leads nuevos y el usuario todavia no eligio marca manualmente,
          // saltamos a la marca del lead mas reciente.
          if (!userPickedBrand && leadList.length > prev.length) {
            setSelectedBrandId((currentId) => {
              const candidate = pickDefaultBrandId(brands, leadList);
              return candidate || currentId;
            });
          }
          return leadList;
        });
      } catch {
        // silencioso: seguimos intentando
      }
      if (elapsed >= maxMs) {
        clearInterval(interval);
        setAutoRefreshing(false);
      }
    }, intervalMs);
    return () => {
      clearInterval(interval);
      setAutoRefreshing(false);
    };
  }, [tenantId, brands, userPickedBrand]);

  const filteredLeads = useMemo(
    () => (selectedBrandId ? leads.filter((l) => l.brandId === selectedBrandId) : leads),
    [leads, selectedBrandId]
  );

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId) || null,
    [brands, selectedBrandId]
  );

  const refreshLeads = async () => {
    if (!tenantId) return;
    setActionLoading('refresh');
    try {
      const leadList = await leadsApi.list(tenantId);
      setLeads(leadList);
      setNotice({ kind: 'info', text: 'Leads actualizados.' });
    } catch (err) {
      setNotice({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo refrescar.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const runDiscovery = async (enrich: boolean) => {
    if (!tenantId || !selectedBrand) return;
    if (!selectedBrand.domain) {
      setNotice({
        kind: 'err',
        text: `La marca "${selectedBrand.name}" no tiene dominio configurado. Configurá uno en Settings.`,
      });
      return;
    }
    setActionLoading(enrich ? 'enrich' : 'discover');
    setNotice(null);
    try {
      await leadsApi.discover({
        tenantId,
        domain: selectedBrand.domain,
        enrich,
      });
      const leadList = await leadsApi.list(tenantId);
      setLeads(leadList);
      setNotice({
        kind: 'ok',
        text: enrich
          ? 'Contactos buscados con Firecrawl y Hunter.'
          : 'Competidores detectados.',
      });
    } catch (err) {
      setNotice({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo ejecutar la detección.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
          <p className="mt-4 text-muted-foreground">Cargando outreach...</p>
        </div>
      </div>
    );
  }

  const totalContacts = filteredLeads.reduce((sum, l) => sum + (l.contacts?.length || 0), 0);
  const totalFirecrawl = filteredLeads.reduce(
    (sum, l) => sum + (l.contacts || []).filter((c) => c.source === 'firecrawl').length,
    0
  );
  const totalHunter = filteredLeads.reduce(
    (sum, l) => sum + (l.contacts || []).filter((c) => c.source === 'hunter').length,
    0
  );

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-primary-700">Outreach</p>
          <h1 className="text-3xl font-bold text-foreground">Competidores detectados y contactos</h1>
          <p className="text-muted-foreground">
            Los resultados se generan <strong>automáticamente</strong> al terminar cada diagnóstico.
            Esta pantalla muestra los competidores que te ganan en el Top 3 junto a los contactos que
            trae Firecrawl (scraping del sitio) y Hunter.io (búsqueda por dominio).
          </p>
        </div>

        {/* Selector de marca + estado */}
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-foreground">Marca</CardTitle>
            <CardDescription>
              Mostramos por defecto la marca del último diagnóstico. Podés cambiar si querés revisar otra.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
              <select
                value={selectedBrandId}
                onChange={(e) => {
                  setSelectedBrandId(e.target.value);
                  setUserPickedBrand(true);
                }}
                className="w-full md:w-80 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {brands.length === 0 && <option>Sin marcas cargadas</option>}
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.domain ? ` · ${b.domain}` : ''}
                  </option>
                ))}
              </select>
              {selectedBrand?.domain ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                  <Globe className="h-3 w-3" />
                  {selectedBrand.domain}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  Marca sin dominio
                </span>
              )}
              {autoRefreshing && (
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  Actualizando automáticamente
                </span>
              )}
              <button
                type="button"
                onClick={refreshLeads}
                disabled={!!actionLoading}
                className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                {actionLoading === 'refresh' ? 'Refrescando…' : 'Refrescar ahora'}
              </button>
            </div>

            {notice && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  notice.kind === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : notice.kind === 'err'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {notice.text}
              </div>
            )}

            {/* Acciones manuales (avanzado) — solo por si el automatico fallo */}
            <div className="border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                {showAdvanced ? '− Ocultar controles manuales' : '+ Forzar ejecución manual (avanzado)'}
              </button>
              {showAdvanced && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => runDiscovery(false)}
                    disabled={!selectedBrand?.domain || !!actionLoading}
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {actionLoading === 'discover' ? 'Detectando…' : 'Detectar competidores'}
                  </Button>
                  <Button
                    onClick={() => runDiscovery(true)}
                    disabled={!selectedBrand?.domain || !!actionLoading}
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {actionLoading === 'enrich'
                      ? 'Buscando contactos…'
                      : 'Buscar contactos (Firecrawl + Hunter)'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumen */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Competidores</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{filteredLeads.length}</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Contactos totales</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{totalContacts}</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-blue-700">Firecrawl</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{totalFirecrawl}</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-purple-700">Hunter.io</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{totalHunter}</p>
            </CardContent>
          </Card>
        </div>

        {/* Leads */}
        {filteredLeads.length === 0 ? (
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Sparkles className="h-10 w-10 text-primary-600" />
              <p className="text-lg font-semibold text-foreground">
                Todavía no hay resultados para esta marca
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {autoRefreshing
                  ? 'Si acabás de lanzar un diagnóstico, Firecrawl y Hunter pueden tardar entre 30 y 90 segundos. La pantalla se actualiza sola.'
                  : 'Corré un diagnóstico para esta marca y los competidores con sus contactos van a aparecer acá automáticamente.'}
              </p>
              <Link href="/diagnostico" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Ir a Diagnóstico →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
