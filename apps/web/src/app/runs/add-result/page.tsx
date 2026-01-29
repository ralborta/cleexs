'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { runsApi, promptsApi, Run, Prompt } from '@/lib/api';
import { useRouter } from 'next/navigation';

const MOCK_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_VERSION_ID = '00000000-0000-0000-0000-000000000010';

export default function AddResultPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [responseText, setResponseText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [runsData, promptsData] = await Promise.all([
          runsApi.list(MOCK_TENANT_ID),
          promptsApi.getPrompts(MOCK_VERSION_ID),
        ]);
        setRuns(runsData);
        setPrompts(promptsData.filter((p) => p.active));
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

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
      <div className="container mx-auto p-6">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Agregar Resultado Manual</h1>
        <p className="text-muted-foreground">
          Carga la respuesta completa de ChatGPT para un prompt específico
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo Resultado</CardTitle>
          <CardDescription>
            Selecciona un Run y un Prompt, luego pega la respuesta completa de ChatGPT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Run</label>
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
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
              <label className="block text-sm font-medium mb-2">Prompt</label>
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
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
                <label className="block text-sm font-medium mb-2">Prompt completo:</label>
                <div className="rounded-md border border-input bg-muted p-3 text-sm">
                  {prompts.find((p) => p.id === selectedPromptId)?.promptText}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Respuesta de ChatGPT (completa)
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 min-h-[300px] font-mono text-sm"
                placeholder="Pega aquí la respuesta completa de ChatGPT..."
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {responseText.length} caracteres
                {responseText.length > 100000 && ' (se truncará a 100KB)'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar Resultado'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
