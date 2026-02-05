'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { runsApi } from '@/lib/api';

interface PromptResult {
  id: string;
  prompt: {
    id: string;
    promptText: string;
    category?: { name: string };
  };
  responseText: string;
  top3Json: Array<{ position: number; name: string; type: string; reason?: string }>;
  score: number;
  flags: Record<string, boolean>;
  truncated: boolean;
  manualOverride: boolean;
}

interface RunWithDetails {
  id: string;
  brand: { name: string };
  periodStart: string;
  periodEnd: string;
  promptResults?: PromptResult[];
}

export default function RunResultDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const resultId = params.resultId as string;
  const [run, setRun] = useState<RunWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !resultId) return;
    setRun(null);
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await runsApi.get(runId);
        if (cancelled) return;
        setRun(data as RunWithDetails);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, resultId]);

  const result = run?.promptResults?.find((r) => r.id === resultId);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (error || !run || !result) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-muted-foreground">{error || 'No se encontró el resultado.'}</p>
          <Link href="/runs">
            <Button variant="outline" className="border-border text-foreground hover:bg-primary-50">
              Volver a Corridas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/runs">
            <Button variant="outline" className="border-border text-foreground hover:bg-primary-50">
              ← Volver a Corridas
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Run {run.id.slice(0, 8)}</span>
            {' — '}
            {run.brand.name} — {new Date(run.periodStart).toLocaleDateString('es-AR')} a{' '}
            {new Date(run.periodEnd).toLocaleDateString('es-AR')}
          </p>
        </div>

        <Card className="border-transparent bg-white shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Detalle del resultado</CardTitle>
            <CardDescription className="text-muted-foreground">
              Prompt y respuesta para esta consulta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border-l-4 border-primary bg-primary-50/40 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-700">
                Consulta enviada (prompt)
              </p>
              <div className="rounded border border-primary-100 bg-white p-3 text-sm text-foreground">
                {result.prompt.promptText}
              </div>
            </div>

            {result.top3Json.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">Top 3 (extraído)</p>
                <ul className="space-y-2 rounded-lg border border-border bg-white p-4">
                  {result.top3Json.map((entry) => (
                    <li key={entry.position} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{entry.position}. {entry.name}</span>
                      {entry.reason && (
                        <span className="block pl-4 text-xs text-muted-foreground/90">— {entry.reason}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Score</p>
              <p className="text-2xl font-bold text-foreground">{(result.score * 100).toFixed(1)}</p>
            </div>

            <div className="rounded-lg border-l-4 border-muted-foreground/40 bg-muted/20 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Respuesta del modelo (texto completo)
              </p>
              {(() => {
                const text = result.responseText;
                const firstLineEnd = text.indexOf('\n');
                const hasFirstLine = firstLineEnd > 0;
                const responseTitle = hasFirstLine ? text.slice(0, firstLineEnd).trim() : null;
                const responseBody = hasFirstLine ? text.slice(firstLineEnd).trim() : text;
                const showBody = responseBody || (!responseTitle ? text : null);
                return (
                  <>
                    {responseTitle && (
                      <p className="mb-2 text-xs italic text-muted-foreground" aria-hidden="true">
                        Encabezado en la respuesta: {responseTitle}
                      </p>
                    )}
                    <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded border border-border bg-white p-4 text-xs text-foreground">
                      {showBody ?? '—'}
                      {result.truncated && (
                        <span className="text-muted-foreground"> … (respuesta recortada al guardar)</span>
                      )}
                    </pre>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
