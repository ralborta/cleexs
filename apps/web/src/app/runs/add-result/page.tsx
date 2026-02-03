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
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-purple-700">Carga manual</p>
          <h1 className="text-3xl font-bold text-gray-900">Agregar Resultado Manual</h1>
          <p className="text-gray-600">
            Pegá la respuesta completa de ChatGPT para que el sistema detecte el Top 3 y calcule PRIA.
          </p>
        </div>

        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-gray-900">Nuevo Resultado</CardTitle>
            <CardDescription>
              Seleccioná un Run y un Prompt, luego pega la respuesta completa de ChatGPT
            </CardDescription>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Run</label>
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              <label className="block text-sm font-medium mb-2 text-gray-700">Prompt</label>
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                <label className="block text-sm font-medium mb-2 text-gray-700">Prompt completo:</label>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  {prompts.find((p) => p.id === selectedPromptId)?.promptText}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Respuesta de ChatGPT (completa)
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 min-h-[300px] font-mono text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Pega aquí la respuesta completa de ChatGPT..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {responseText.length} caracteres
                {responseText.length > 100000 && ' (se truncará a 100KB)'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
              >
                {submitting ? 'Guardando...' : 'Guardar Resultado'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-gray-200 text-gray-700 hover:bg-gray-50"
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
