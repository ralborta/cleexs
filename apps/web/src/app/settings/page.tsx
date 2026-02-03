'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { brandsApi, promptsApi, runsApi, Brand, PromptVersion } from '@/lib/api';

const MOCK_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default function SettingsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const [brandName, setBrandName] = useState('');
  const [brandDomain, setBrandDomain] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [competitorName, setCompetitorName] = useState('');

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
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);

  const [runBrandId, setRunBrandId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [brandsData, versionsData] = await Promise.all([
          brandsApi.list(MOCK_TENANT_ID),
          promptsApi.getVersions(MOCK_TENANT_ID),
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

  const handleCreateBrand = async () => {
    if (!brandName.trim()) {
      alert('Ingresá el nombre de la marca');
      return;
    }
    try {
      await brandsApi.create({
        tenantId: MOCK_TENANT_ID,
        name: brandName.trim(),
        domain: brandDomain.trim() || undefined,
      });
      const updated = await brandsApi.list(MOCK_TENANT_ID);
      setBrands(updated);
      setBrandName('');
      setBrandDomain('');
      alert('Marca creada');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleAddCompetitor = async () => {
    if (!selectedBrandId) {
      alert('Seleccioná una marca');
      return;
    }
    if (!competitorName.trim()) {
      alert('Ingresá un competidor');
      return;
    }
    try {
      await brandsApi.addCompetitor(selectedBrandId, { name: competitorName.trim() });
      const updated = await brandsApi.list(MOCK_TENANT_ID);
      setBrands(updated);
      setCompetitorName('');
      alert('Competidor agregado');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleCreateVersion = async () => {
    if (!versionName.trim()) {
      alert('Ingresá el nombre de la versión');
      return;
    }
    try {
      await promptsApi.createVersion({ tenantId: MOCK_TENANT_ID, name: versionName.trim() });
      const updated = await promptsApi.getVersions(MOCK_TENANT_ID);
      setPromptVersions(updated);
      setVersionName('');
      alert('Versión creada');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleCreatePrompt = async () => {
    if (!selectedVersionId) {
      alert('Seleccioná una versión');
      return;
    }
    if (!promptText.trim()) {
      alert('Ingresá el prompt');
      return;
    }
    try {
      await promptsApi.createPrompt({ promptVersionId: selectedVersionId, promptText: promptText.trim() });
      setPromptText('');
      alert('Prompt creado');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const splitList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

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

    const esPrompts = [
      `¿Cuáles son las mejores opciones de ${product} en ${country} para ${objective}?`,
      `Compará ${product} para ${industry}: ventajas, desventajas y para quién es mejor.`,
      `¿Qué alternativas a ${product} recomiendas y por qué? (${competitorText})`,
      `En ${country}, ¿qué ${product} es mejor para ${useCaseText}?`,
      `¿Qué factores debo evaluar al elegir ${product}? (${factorText})`,
    ];

    const ptPrompts = [
      `Quais são as melhores opções de ${product} em ${country} para ${objective}?`,
      `Compare ${product} para ${industry}: vantagens, desvantagens e para quem é melhor.`,
      `Quais alternativas a ${product} você recomenda e por quê? (${competitorText})`,
      `Em ${country}, qual ${product} é melhor para ${useCaseText}?`,
      `Quais fatores devo avaliar ao escolher ${product}? (${factorText})`,
    ];

    return [...esPrompts, ...ptPrompts];
  };

  const handleGeneratePrompts = () => {
    const prompts = buildPrompts();
    setGeneratedPrompts(prompts.slice(0, 10));
  };

  const handleSaveGeneratedPrompts = async () => {
    if (!generatedPrompts.length) {
      alert('Generá los prompts primero');
      return;
    }
    try {
      const version = await promptsApi.createVersion({
        tenantId: MOCK_TENANT_ID,
        name: 'PROMPTS_v1',
      });
      await Promise.all(
        generatedPrompts.map((text) =>
          promptsApi.createPrompt({ promptVersionId: version.id, promptText: text, active: true })
        )
      );
      const updated = await promptsApi.getVersions(MOCK_TENANT_ID);
      setPromptVersions(updated);
      setSelectedVersionId(version.id);
      alert('PROMPTS_v1 creado');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleCreateRun = async () => {
    if (!runBrandId) {
      alert('Seleccioná una marca');
      return;
    }
    if (!periodStart || !periodEnd) {
      alert('Seleccioná fechas de inicio y fin');
      return;
    }
    try {
      await runsApi.create({
        tenantId: MOCK_TENANT_ID,
        brandId: runBrandId,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
      });
      alert('Run creado');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-medium text-purple-700">Setup</p>
          <h1 className="text-3xl font-bold text-gray-900">Configuración Inicial</h1>
          <p className="text-gray-600">
            Acá cargás tu marca, competidores, prompts y creás el primer run.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-gray-900">Marca</CardTitle>
              <CardDescription>Creá tu marca principal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Nombre</label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: Cleexs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Dominio (opcional)</label>
                <input
                  value={brandDomain}
                  onChange={(e) => setBrandDomain(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="cleexs.com"
                />
              </div>
              <Button
                onClick={handleCreateBrand}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
              >
                Crear Marca
              </Button>
            </CardContent>
          </Card>

          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-gray-900">Competidores</CardTitle>
              <CardDescription>Agregá competidores para comparar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Marca</label>
                <select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Competidor</label>
                <input
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: Temso"
                />
              </div>
              <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50" onClick={handleAddCompetitor}>
                Agregar Competidor
              </Button>
            </CardContent>
          </Card>

          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-gray-900">Prompts</CardTitle>
              <CardDescription>Creá la versión de prompts y agregá consultas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Nueva versión</label>
                <div className="flex gap-2">
                  <input
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="PROMPTS_v1"
                  />
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                    onClick={handleCreateVersion}
                  >
                    Crear
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Versión activa</label>
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {promptVersions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Nuevo prompt</label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px]"
                  placeholder="Ej: ¿Cuál es la mejor plataforma para..."
                />
              </div>
              <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50" onClick={handleCreatePrompt}>
                Agregar Prompt
              </Button>
            </CardContent>
          </Card>

          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-gray-900">Wizard de Prompts (ES + PT)</CardTitle>
              <CardDescription>
                Respondé 8 preguntas y generamos 10 prompts para PROMPTS_v1.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Industria</label>
                <input
                  value={wizardIndustry}
                  onChange={(e) => setWizardIndustry(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: SaaS, Fintech, Retail"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Tipo de producto</label>
                <input
                  value={wizardProductType}
                  onChange={(e) => setWizardProductType(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: plataforma de inversión"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">País/mercado</label>
                <input
                  value={wizardCountry}
                  onChange={(e) => setWizardCountry(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: Brasil, España"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Objetivo</label>
                <input
                  value={wizardObjective}
                  onChange={(e) => setWizardObjective(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: consideración, conversión"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Competidores (coma)</label>
                <input
                  value={wizardCompetitors}
                  onChange={(e) => setWizardCompetitors(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: Temso, Uber, Duolingo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Casos de uso (coma)</label>
                <input
                  value={wizardUseCases}
                  onChange={(e) => setWizardUseCases(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: inversión inicial, portafolio, ahorro"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Factores decisivos (coma)</label>
                <input
                  value={wizardFactors}
                  onChange={(e) => setWizardFactors(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: precio, soporte, facilidad de uso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Tono/estilo</label>
                <input
                  value={wizardTone}
                  onChange={(e) => setWizardTone(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: claro y directo"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  onClick={handleGeneratePrompts}
                >
                  Generar 10 prompts
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                  onClick={handleSaveGeneratedPrompts}
                >
                  Guardar PROMPTS_v1
                </Button>
              </div>
              {generatedPrompts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Prompts generados (editables):</p>
                  {generatedPrompts.map((prompt, idx) => (
                    <textarea
                      key={idx}
                      value={prompt}
                      onChange={(e) => {
                        const next = [...generatedPrompts];
                        next[idx] = e.target.value;
                        setGeneratedPrompts(next);
                      }}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-gray-900">Crear Run</CardTitle>
              <CardDescription>Definí el período para iniciar una corrida.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Marca</label>
                <select
                  value={runBrandId}
                  onChange={(e) => setRunBrandId(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  <label className="block text-sm font-medium mb-2 text-gray-700">Inicio</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Fin</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <Button
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                onClick={handleCreateRun}
              >
                Crear Run
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
