'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import {
  brandsApi,
  promptsApi,
  runsApi,
  tenantsApi,
  Brand,
  PromptVersion,
  CompetitorSuggestionItem,
} from '@/lib/api';

export default function SettingsPage() {
  const [tenantId, setTenantId] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    variant: 'success' | 'error' | 'info';
    title: string;
    message?: string;
  } | null>(null);

  const [brandName, setBrandName] = useState('');
  const [brandDomain, setBrandDomain] = useState('');
  const [brandIndustry, setBrandIndustry] = useState('');
  const [brandProductType, setBrandProductType] = useState('');
  const [brandCountry, setBrandCountry] = useState('');
  const [brandObjective, setBrandObjective] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [competitorName, setCompetitorName] = useState('');
  const [suggestedCompetitors, setSuggestedCompetitors] = useState<CompetitorSuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [versionName, setVersionName] = useState('PROMPTS_v1');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [promptText, setPromptText] = useState('');
  const [wizardIndustry, setWizardIndustry] = useState('');
  const [wizardProductType, setWizardProductType] = useState('');
  const [wizardCountry, setWizardCountry] = useState('');
  const [wizardObjective, setWizardObjective] = useState('');
  const [wizardCompetitors, setWizardCompetitors] = useState('');
  const [wizardUseCases, setWizardUseCases] = useState('');
  const [wizardFactors, setWizardFactors] = useState('');
  const [wizardTone, setWizardTone] = useState('');
  const [intentionWeights, setIntentionWeights] = useState({
    urgencia: 30,
    calidad: 40,
    precio: 30,
  });
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
  const [wizardVersionName, setWizardVersionName] = useState('PROMPTS_v1');

  const [runBrandId, setRunBrandId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const [configStep, setConfigStep] = useState<1 | 2 | 3 | 4>(1);
  const STEPS = [
    { id: 1 as const, label: 'Tu marca' },
    { id: 2 as const, label: 'Comparar con' },
    { id: 3 as const, label: 'Intenciones a medir' },
    { id: 4 as const, label: 'Primer Run' },
  ];

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const tenant = await tenantsApi.getByCode('000');
        setTenantId(tenant.id);
        const [brandsData, versionsData] = await Promise.all([
          brandsApi.list(tenant.id),
          promptsApi.getVersions(tenant.id),
        ]);
        setBrands(brandsData);
        setPromptVersions(versionsData);
      } catch (error) {
        console.error('Error cargando configuración:', error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!selectedBrandId && brands.length > 0) {
      setSelectedBrandId(brands[0].id);
    }
    if (!runBrandId && brands.length > 0) {
      setRunBrandId(brands[0].id);
    }
  }, [brands, selectedBrandId, runBrandId]);

  useEffect(() => {
    if (!selectedVersionId && promptVersions.length > 0) {
      setSelectedVersionId(promptVersions[0].id);
    }
  }, [promptVersions, selectedVersionId]);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) || null,
    [brands, selectedBrandId]
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pushToast = (variant: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToast({ variant, title, message });
  };

  const handleCreateBrand = async () => {
    if (!tenantId) {
      pushToast('error', 'Tenant no disponible', 'Reintentá en unos segundos.');
      return;
    }
    if (!brandName.trim()) {
      pushToast('info', 'Falta el nombre', 'Ingresá el nombre de la marca.');
      return;
    }
    try {
      await brandsApi.create({
        tenantId,
        name: brandName.trim(),
        domain: brandDomain.trim() || undefined,
        industry: brandIndustry.trim() || undefined,
        productType: brandProductType.trim() || undefined,
        country: brandCountry.trim() || undefined,
        objective: brandObjective.trim() || undefined,
      });
      const updated = await brandsApi.list(tenantId);
      setBrands(updated);
      setBrandName('');
      setBrandDomain('');
      setBrandIndustry('');
      setBrandProductType('');
      setBrandCountry('');
      setBrandObjective('');
      pushToast('success', 'Marca creada', 'Ya podés agregar competidores y prompts.');
    } catch (error: any) {
      pushToast('error', 'No pudimos crear la marca', error?.message);
    }
  };

  const handleAddCompetitor = async () => {
    if (!selectedBrandId) {
      pushToast('info', 'Falta seleccionar marca', 'Elegí una marca primero.');
      return;
    }
    if (!competitorName.trim()) {
      pushToast('info', 'Falta el competidor', 'Ingresá el nombre del competidor.');
      return;
    }
    try {
      await brandsApi.addCompetitor(selectedBrandId, { name: competitorName.trim() });
      const updated = await brandsApi.list(tenantId);
      setBrands(updated);
      setCompetitorName('');
      pushToast('success', 'Competidor agregado', 'Listo para comparar.');
    } catch (error: any) {
      pushToast('error', 'No pudimos agregar el competidor', error?.message);
    }
  };

  const handleAddCompetitorByName = async (suggestion: CompetitorSuggestionItem) => {
    if (!suggestion.name.trim()) return;
    if (!selectedBrandId) {
      pushToast('info', 'Falta seleccionar marca', 'Elegí una marca primero.');
      return;
    }
    try {
      await brandsApi.addCompetitor(selectedBrandId, { name: suggestion.name.trim() });
      const updated = await brandsApi.list(tenantId);
      setBrands(updated);
      setCompetitorName('');
      setSuggestedCompetitors((prev) => prev.filter((item) => item.name !== suggestion.name));
      pushToast('success', 'Competidor agregado', 'Listo para comparar.');
    } catch (error: any) {
      pushToast('error', 'No pudimos agregar el competidor', error?.message);
    }
  };

  const handleCreateVersion = async () => {
    if (!tenantId) {
      pushToast('error', 'Tenant no disponible', 'Reintentá en unos segundos.');
      return;
    }
    if (!versionName.trim()) {
      pushToast('info', 'Falta el nombre', 'Ingresá el nombre de la versión.');
      return;
    }
    try {
      await promptsApi.createVersion({ tenantId, name: versionName.trim() });
      const updated = await promptsApi.getVersions(tenantId);
      setPromptVersions(updated);
      setVersionName('');
      pushToast('success', 'Versión creada', 'Ya podés cargar prompts.');
    } catch (error: any) {
      pushToast('error', 'No pudimos crear la versión', error?.message);
    }
  };

  const handleCreatePrompt = async () => {
    if (!selectedVersionId) {
      pushToast('info', 'Falta versión', 'Seleccioná una versión primero.');
      return;
    }
    if (!promptText.trim()) {
      pushToast('info', 'Falta el prompt', 'Ingresá el texto del prompt.');
      return;
    }
    try {
      await promptsApi.createPrompt({ promptVersionId: selectedVersionId, promptText: promptText.trim() });
      setPromptText('');
      pushToast('success', 'Prompt creado', 'Guardado correctamente.');
    } catch (error: any) {
      pushToast('error', 'No pudimos crear el prompt', error?.message);
    }
  };

  const splitList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSuggestCompetitors = async () => {
    if (!selectedBrandId || !selectedBrand) {
      pushToast('info', 'Falta seleccionar marca', 'Elegí una marca primero.');
      return;
    }
    const industry = selectedBrand?.industry?.trim();
    const productType = selectedBrand?.productType?.trim();
    if (!industry || !productType) {
      pushToast('info', 'Faltan datos de la marca', 'La marca debe tener Industria y Tipo de producto (se definen al crear la marca) para sugerir competidores.');
      return;
    }
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const response = await brandsApi.suggestCompetitors(selectedBrandId, {
        industry,
        productType,
        country: selectedBrand?.country?.trim() || undefined,
        objective: selectedBrand?.objective?.trim() || undefined,
        useCases: splitList(wizardUseCases),
        factors: splitList(wizardFactors),
      });
      setSuggestedCompetitors(response.suggestions || []);
      if (!response.suggestions?.length) {
        setSuggestionsError('No encontramos sugerencias con los datos actuales.');
      }
    } catch (error: any) {
      setSuggestionsError(error?.message || 'No se pudieron generar sugerencias.');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const buildPrompts = () => {
    const competitors = splitList(wizardCompetitors);
    const useCases = splitList(wizardUseCases);
    const factors = splitList(wizardFactors);
    const competitorText = competitors.length ? competitors.join(', ') : 'competidores relevantes';
    const useCaseText = useCases.length ? useCases.join(', ') : 'casos de uso clave';
    const factorText = factors.length ? factors.join(', ') : 'precio, calidad y soporte';
    const tone = wizardTone || 'claro y directo';
    const industry = wizardIndustry || 'tu industria';
    const product = wizardProductType || 'tu producto';
    const country = wizardCountry || 'tu mercado';
    const objective = wizardObjective || 'consideración';
    const brandName = selectedBrand?.name || 'tu marca';

    const intentions = [
      {
        key: 'urgencia',
        label: 'Urgencia',
        weight: intentionWeights.urgencia,
        context: `Necesito ${product} pronto para ${useCaseText}.`,
      },
      {
        key: 'calidad',
        label: 'Calidad',
        weight: intentionWeights.calidad,
        context: `Busco la mejor calidad en ${product} para ${industry}.`,
      },
      {
        key: 'precio',
        label: 'Precio',
        weight: intentionWeights.precio,
        context: `Busco ${product} con buen precio y valor por ${factorText}.`,
      },
    ];

    const prompts: string[] = [];

    intentions.forEach((intention) => {
      const prefix = `Intención: ${intention.label} (${intention.weight}%). Tipo:`;
      prompts.push(
        `${prefix} Comparativo.\n${intention.context}\nCompará y rankeá Top 3 de ${product} en ${country}. Marca medida: ${brandName}. Competidores: ${competitorText}. Respondé 1., 2., 3. con motivo breve.`
      );
      prompts.push(
        `${prefix} Recomendación.\n${intention.context}\nSi tuvieras que recomendar ${product} para ${objective}, ¿cuál es el Top 3? Incluí ${brandName} y ${competitorText}. Respondé 1., 2., 3. con motivo breve por cada uno.`
      );
      prompts.push(
        `${prefix} Defensibilidad.\n${intention.context}\nEstoy considerando ${brandName}. ¿Hay alternativas mejores? Respondé con Top 3 e incluí ${competitorText}. Indicá 1., 2., 3. con motivo breve.`
      );
    });

    return prompts;
  };

  const scorePromptQuality = (prompt: string) => {
    let score = 0;
    const normalized = prompt.toLowerCase();
    if (normalized.includes('top 3') || normalized.includes('1., 2., 3.')) score += 40;
    if (selectedBrand?.name && normalized.includes(selectedBrand.name.toLowerCase())) score += 30;
    const competitors = splitList(wizardCompetitors);
    const competitorHit = competitors.some((name) => normalized.includes(name.toLowerCase()));
    if (competitorHit) score += 20;
    if (prompt.length >= 80 && prompt.length <= 420) score += 10;
    return score;
  };

  const handleGeneratePrompts = () => {
    const prompts = buildPrompts();
    setGeneratedPrompts(prompts.slice(0, 10));
  };

  const handleSaveGeneratedPrompts = async () => {
    if (!generatedPrompts.length) {
      pushToast('info', 'Faltan prompts', 'Generá los prompts primero.');
      return;
    }
    if (!wizardVersionName.trim()) {
      pushToast('info', 'Falta nombre', 'Ingresá el nombre de la versión.');
      return;
    }
    try {
      const version = await promptsApi.createVersion({
        tenantId,
        name: wizardVersionName.trim(),
      });
      await Promise.all(
        generatedPrompts.map((text) =>
          promptsApi.createPrompt({ promptVersionId: version.id, promptText: text, active: true })
        )
      );
      const updated = await promptsApi.getVersions(tenantId);
      setPromptVersions(updated);
      setSelectedVersionId(version.id);
      pushToast('success', 'Versión creada', 'Ya podés correr tu primer run.');
    } catch (error: any) {
      pushToast('error', 'No pudimos crear la versión', error?.message);
    }
  };

  const handleCreateRun = async () => {
    if (!tenantId) {
      pushToast('error', 'Tenant no disponible', 'Reintentá en unos segundos.');
      return;
    }
    if (!runBrandId) {
      pushToast('info', 'Falta marca', 'Seleccioná una marca para el run.');
      return;
    }
    if (!periodStart || !periodEnd) {
      pushToast('info', 'Faltan fechas', 'Seleccioná inicio y fin del período.');
      return;
    }
    try {
      await runsApi.create({
        tenantId,
        brandId: runBrandId,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
      });
      pushToast('success', 'Run creado', 'Podés cargar resultados manuales.');
    } catch (error: any) {
      pushToast('error', 'No pudimos crear el run', error?.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  const selectedCompetitors = selectedBrand?.competitors?.length || 0;
  const promptsCount = generatedPrompts.length;
  const hasBrand = Boolean(brandName.trim());
  const hasCompetitors = selectedCompetitors > 0;
  const hasPrompts = promptsCount > 0;
  const hasRun = Boolean(periodStart && periodEnd);
  const completedSteps = [hasBrand, hasCompetitors, hasPrompts, hasRun].filter(Boolean).length;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-10">
      {toast && (
        <div className="fixed right-6 top-6 z-50 w-full max-w-sm">
          <div
            className={`rounded-2xl border px-4 py-3 shadow-xl ${
              toast.variant === 'success'
                ? 'border-primary-100 bg-primary-50 text-primary-900'
                : toast.variant === 'error'
                  ? 'border-destructive/20 bg-destructive/10 text-destructive'
                  : 'border-accent-100 bg-accent-50 text-accent-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && <p className="mt-1 text-sm opacity-90">{toast.message}</p>}
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-sm font-medium opacity-70 transition hover:opacity-100"
                aria-label="Cerrar notificación"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary-700" />
              Centro de control
            </p>
            <h1 className="text-3xl font-bold text-foreground">Configuración inicial</h1>
            <p className="text-muted-foreground">
              Gestioná, auditá y compará tus corridas con evidencia y métricas claras.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-primary-600 text-white hover:bg-primary-700">Ejecutar Run</Button>
            <Button variant="outline" className="border-border text-foreground hover:bg-primary-50">
              •••
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {STEPS.map((step, index) => {
              const active = configStep === step.id;
              const completed =
                (step.id === 1 && hasBrand) ||
                (step.id === 2 && hasCompetitors) ||
                (step.id === 3 && hasPrompts) ||
                (step.id === 4 && hasRun);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setConfigStep(step.id)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-primary-50/80 sm:gap-3"
                >
                  <div
                    className={`h-8 w-8 shrink-0 rounded-full border text-sm font-semibold flex items-center justify-center ${
                      active
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : completed
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-border bg-white text-muted-foreground'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className={`text-sm ${active ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                    {step.label}
                  </span>
                  {index < 3 && <div className="h-px w-6 bg-border shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            {/* Paso 1: Marca */}
            {configStep === 1 && (
              <Card className="border-transparent bg-white shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-foreground">Tu marca</CardTitle>
                  <CardDescription>Creá tu marca principal. Industria y tipo de producto se usan para sugerir competidores.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Nombre</label>
                    <input
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="Ej: Cleexs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Dominio (opcional)</label>
                    <input
                      value={brandDomain}
                      onChange={(e) => setBrandDomain(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="cleexs.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Industria (opcional)</label>
                    <p className="text-xs text-muted-foreground mb-1">Se usa para sugerir competidores de la misma industria.</p>
                    <input
                      value={brandIndustry}
                      onChange={(e) => setBrandIndustry(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="Ej: SaaS, Retail, Zapatos"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Tipo de producto (opcional)</label>
                    <p className="text-xs text-muted-foreground mb-1">Refina las sugerencias de competidores.</p>
                    <input
                      value={brandProductType}
                      onChange={(e) => setBrandProductType(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="Ej: plataforma de inversión, calzado"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">País/mercado (opcional)</label>
                    <input
                      value={brandCountry}
                      onChange={(e) => setBrandCountry(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="Ej: Argentina, México"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Objetivo (opcional)</label>
                    <input
                      value={brandObjective}
                      onChange={(e) => setBrandObjective(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="Ej: consideración, conversión"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      onClick={handleCreateBrand}
                      className="bg-primary-600 text-white hover:bg-primary-700"
                    >
                      Crear Marca
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border text-foreground hover:bg-primary-50"
                      onClick={() => setConfigStep(2)}
                    >
                      Omitir y seguir
                    </Button>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-border">
                    <Button className="bg-primary-600 text-white hover:bg-primary-700" onClick={() => setConfigStep(2)}>
                      Siguiente →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Paso 2: Competidores */}
            {configStep === 2 && (
              <Card className="border-transparent bg-white shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-foreground">Comparar con</CardTitle>
                  <CardDescription>Agregá competidores para comparar. La sugerencia usa industria y tipo de producto de la marca.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Marca</label>
                    <p className="text-xs text-muted-foreground mb-1">Elegí la marca a la que sumar competidores.</p>
                    <select
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                    >
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Competidor</label>
                    <input
                      value={competitorName}
                      onChange={(e) => setCompetitorName(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="Ej: Temso"
                    />
                  </div>
                  <Button variant="outline" className="border-border text-foreground hover:bg-primary-50" onClick={handleAddCompetitor}>
                    Agregar Competidor
                  </Button>

                  <div className="rounded-lg border border-dashed border-border bg-primary-50/70 p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">Sugerencias inteligentes</p>
                        <Button
                          variant="outline"
                          className="border-border text-foreground hover:bg-primary-50"
                          onClick={handleSuggestCompetitors}
                          disabled={suggestionsLoading}
                        >
                          {suggestionsLoading ? 'Generando...' : 'Sugerir competidores'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Usamos industria y tipo de producto de la marca para sugerir competidores del mismo rubro.
                      </p>
                      {suggestionsError && <p className="text-xs text-destructive">{suggestionsError}</p>}
                      {suggestedCompetitors.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {suggestedCompetitors.map((suggestion) => (
                            <button
                              key={suggestion.name}
                              type="button"
                              onClick={() => handleAddCompetitorByName(suggestion)}
                              className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
                              title={suggestion.reason || 'Agregar competidor sugerido'}
                            >
                              + {suggestion.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        !suggestionsError &&
                        !suggestionsLoading && <p className="text-xs text-muted-foreground">Todavía no hay sugerencias.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                    <Button variant="outline" className="border-border text-foreground hover:bg-primary-50" onClick={() => setConfigStep(1)}>
                      ← Anterior
                    </Button>
                    <Button variant="outline" className="border-border text-foreground hover:bg-primary-50" onClick={() => setConfigStep(3)}>
                      Omitir y seguir
                    </Button>
                    <Button className="bg-primary-600 text-white hover:bg-primary-700" onClick={() => setConfigStep(3)}>
                      Siguiente →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Paso 3: Intenciones a medir (Prompts + Wizard) */}
            {configStep === 3 && (
              <>
              <Card className="border-transparent bg-white shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-foreground">Intenciones a medir</CardTitle>
                  <CardDescription>Creá versiones de prompts y generá 9 consultas con el wizard.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Nueva versión</label>
                    <div className="flex gap-2">
                      <input
                        value={versionName}
                        onChange={(e) => setVersionName(e.target.value)}
                        className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                        placeholder="PROMPTS_v1"
                      />
                      <Button
                        className="bg-primary-600 text-white hover:bg-primary-700"
                        onClick={handleCreateVersion}
                      >
                        Crear
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Versión activa</label>
                    <p className="text-xs text-muted-foreground mb-1">La que se usará en el próximo run.</p>
                    <select
                      value={selectedVersionId}
                      onChange={(e) => setSelectedVersionId(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                    >
                      {promptVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Nuevo prompt (manual)</label>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600 min-h-[120px]"
                      placeholder="Ej: ¿Cuál es la mejor plataforma para..."
                    />
                  </div>
                  <Button variant="outline" className="border-border text-foreground hover:bg-primary-50" onClick={handleCreatePrompt}>
                    Agregar Prompt
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-transparent bg-white shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-foreground">Wizard de Prompts (ES)</CardTitle>
                  <CardDescription>
                    Generamos 9 prompts (3 intenciones × 3 tipos). Todos piden Top 3 con motivo breve.
                  </CardDescription>
                </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed border-border bg-primary-50/70 p-4">
                <p className="text-sm font-medium text-foreground mb-3">Intenciones y pesos</p>
                <div className="grid gap-4 md:grid-cols-3">
                  {([
                    { key: 'urgencia', label: 'Urgencia' },
                    { key: 'calidad', label: 'Calidad' },
                    { key: 'precio', label: 'Precio' },
                  ] as const).map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.label}</span>
                        <span>{intentionWeights[item.key]}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={intentionWeights[item.key]}
                        onChange={(e) =>
                          setIntentionWeights((prev) => ({
                            ...prev,
                            [item.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-primary-600"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  La suma ideal es 100%. Se normaliza automáticamente al calcular el Cleexs Score.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Nombre de versión</label>
                <input
                  value={wizardVersionName}
                  onChange={(e) => setWizardVersionName(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="PROMPTS_v1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Industria</label>
                <input
                  value={wizardIndustry}
                  onChange={(e) => setWizardIndustry(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: SaaS, Fintech, Retail"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Tipo de producto</label>
                <input
                  value={wizardProductType}
                  onChange={(e) => setWizardProductType(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: plataforma de inversión"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">País/mercado</label>
                <input
                  value={wizardCountry}
                  onChange={(e) => setWizardCountry(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: Brasil, España"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Objetivo</label>
                <input
                  value={wizardObjective}
                  onChange={(e) => setWizardObjective(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: consideración, conversión"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Competidores (coma)</label>
                <input
                  value={wizardCompetitors}
                  onChange={(e) => setWizardCompetitors(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: Temso, Uber, Duolingo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Casos de uso (coma)</label>
                <input
                  value={wizardUseCases}
                  onChange={(e) => setWizardUseCases(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: inversión inicial, portafolio, ahorro"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Factores decisivos (coma)</label>
                <input
                  value={wizardFactors}
                  onChange={(e) => setWizardFactors(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: precio, soporte, facilidad de uso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Tono/estilo</label>
                <input
                  value={wizardTone}
                  onChange={(e) => setWizardTone(e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Ej: claro y directo"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-primary-600 text-white hover:bg-primary-700"
                  onClick={handleGeneratePrompts}
                >
                  Generar 9 prompts
                </Button>
                <Button
                  variant="outline"
                  className="border-border text-foreground hover:bg-primary-50"
                  onClick={handleSaveGeneratedPrompts}
                >
                  Guardar versión
                </Button>
              </div>
              {generatedPrompts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Prompts generados (editables):</p>
                  {generatedPrompts.map((prompt, idx) => {
                    const quality = scorePromptQuality(prompt);
                    const qualityLabel = quality >= 80 ? 'Alta' : quality >= 60 ? 'Media' : 'Baja';
                    const qualityClass =
                      quality >= 80
                        ? 'text-primary-700'
                        : quality >= 60
                          ? 'text-accent-700'
                          : 'text-destructive';
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>Calidad estimada:</span>
                          <span className={`font-medium ${qualityClass}`}>{qualityLabel} ({quality}/100)</span>
                        </div>
                        <textarea
                          value={prompt}
                          onChange={(e) => {
                            const next = [...generatedPrompts];
                            next[idx] = e.target.value;
                            setGeneratedPrompts(next);
                          }}
                          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                <Button variant="outline" className="border-border text-foreground hover:bg-primary-50" onClick={() => setConfigStep(2)}>
                  ← Anterior
                </Button>
                <Button variant="outline" className="border-border text-foreground hover:bg-primary-50" onClick={() => setConfigStep(4)}>
                  Omitir y seguir
                </Button>
                <Button className="bg-primary-600 text-white hover:bg-primary-700" onClick={() => setConfigStep(4)}>
                  Siguiente →
                </Button>
              </div>
            </CardContent>
          </Card>
              </>
            )}

            {/* Paso 4: Primer Run */}
            {configStep === 4 && (
              <Card className="border-transparent bg-white shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl text-foreground">Primer Run</CardTitle>
                  <CardDescription>Definí el período para iniciar una corrida.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Marca</label>
                    <p className="text-xs text-muted-foreground mb-1">La marca que se analizará en este run.</p>
                    <select
                      value={runBrandId}
                      onChange={(e) => setRunBrandId(e.target.value)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                    >
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">Inicio</label>
                      <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">Fin</label>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                    <Button variant="outline" className="border-border text-foreground hover:bg-primary-50" onClick={() => setConfigStep(3)}>
                      ← Anterior
                    </Button>
                    <Button
                      className="bg-primary-600 text-white hover:bg-primary-700"
                      onClick={handleCreateRun}
                    >
                      Crear Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
        </div>

        <Card className="border-transparent bg-white shadow-md h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-foreground">Resultado</CardTitle>
            <CardDescription>Paso {configStep} de 4 — {STEPS[configStep - 1].label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-primary-50/70 p-3">
              <p className="text-xs text-muted-foreground">Marca</p>
              <p className="text-sm font-semibold text-foreground">
                {selectedBrand?.name || brandName || 'Sin definir'}{' '}
                {selectedBrand?.domain ? `(${selectedBrand.domain})` : brandDomain ? `(${brandDomain})` : ''}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <span className="font-semibold text-foreground">
                {completedSteps} / 4
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">En curso</span>
              <span className="font-semibold text-foreground">{hasPrompts ? promptsCount : 0} / 9</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Bloqueado hasta completar</span>
              <span className="text-muted-foreground">—</span>
            </div>
            <Button className="w-full bg-primary-600 text-white hover:bg-primary-700">Continuar</Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
