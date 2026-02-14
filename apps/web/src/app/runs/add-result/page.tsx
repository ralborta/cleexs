'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { runsApi, promptsApi, tenantsApi, Run, Prompt, PromptVersion } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AddResultPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [responseText, setResponseText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const tenant = await tenantsApi.getByCode('000');
        setTenantId(tenant.id);
        const [runsData, versionsData] = await Promise.all([
          runsApi.list(tenant.id),
          promptsApi.getVersions(tenant.id),
        ]);
        setRuns(runsData);
        setPromptVersions(versionsData);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!selectedVersionId && promptVersions.length > 0) {
      setSelectedVersionId(promptVersions[0].id);
    }
  }, [promptVersions, selectedVersionId]);

  useEffect(() => {
    async function loadPrompts() {
      if (!selectedVersionId) {
        setPrompts([]);
        return;
      }
      try {
        const promptsData = await promptsApi.getPrompts(selectedVersionId);
        setPrompts(promptsData.filter((p) => p.active));
      } catch (error) {
        console.error('Error cargando prompts:', error);
      }
    }

    loadPrompts();
  }, [selectedVersionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunId || !selectedPromptId || !responseText.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    setSubmitting(true);
    try {
      await runsApi.addResult(selectedRunId, selectedPromptId, responseText);
      alert('Resultado agregado exitosamente');
      router.push('/runs');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary-700">Carga manual</p>
          <h1 className="text-3xl font-bold text-foreground">Agregar Resultado Manual</h1>
          <p className="text-muted-foreground">
            Pegá la respuesta completa de ChatGPT para que el sistema detecte el Top 3 y calcule el Cleexs Score.
          </p>
        </div>

        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-foreground">Nuevo Resultado</CardTitle>
            <CardDescription className="text-muted-foreground">
              Seleccioná un Run y un Prompt, luego pega la respuesta completa de ChatGPT
            </CardDescription>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">Run</label>
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                required
              >
                <option value="">Selecciona un Run</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.brand.name} -{' '}
                    {new Date(run.periodStart).toLocaleDateString('es-AR')} a{' '}
                    {new Date(run.periodEnd).toLocaleDateString('es-AR')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">Versión de prompts</label>
              <select
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                required
              >
                <option value="">Selecciona una versión</option>
                {promptVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">Prompt</label>
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                required
              >
                <option value="">Selecciona un Prompt</option>
                {prompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.promptText.substring(0, 100)}...
                  </option>
                ))}
              </select>
            </div>

            {selectedPromptId && (
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Prompt completo:</label>
                <div className="rounded-md border border-border bg-primary-50 p-3 text-sm text-muted-foreground">
                  {prompts.find((p) => p.id === selectedPromptId)?.promptText}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Respuesta de ChatGPT (completa)
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 min-h-[300px] font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
                placeholder="Pega aquí la respuesta completa de ChatGPT..."
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {responseText.length} caracteres
                {responseText.length > 100000 && ' (se truncará a 100KB)'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-primary-600 text-white hover:bg-primary-700"
              >
                {submitting ? 'Guardando...' : 'Guardar Resultado'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-border text-foreground hover:bg-primary-50"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
