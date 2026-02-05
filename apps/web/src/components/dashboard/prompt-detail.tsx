'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

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

interface PromptDetailProps {
  results: PromptResult[];
  runId?: string;
}

export function PromptDetail({ results, runId }: PromptDetailProps) {
  return (
    <Card className="border-transparent bg-white shadow-md">
      <CardHeader>
        <CardTitle className="text-xl text-foreground">Detalle por Prompt</CardTitle>
        <CardDescription className="text-muted-foreground">
          Resultados y evidencia por cada consulta. Clic en Ver abre la pantalla de detalle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-primary-50/80 border-b border-border">
              <TableHead className="text-muted-foreground">Prompt</TableHead>
              <TableHead className="text-muted-foreground">Categoría</TableHead>
              <TableHead className="text-muted-foreground">Top 3</TableHead>
              <TableHead className="text-right text-muted-foreground">Score</TableHead>
              <TableHead className="text-muted-foreground">Flags</TableHead>
              <TableHead className="text-muted-foreground">Evidencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No hay resultados disponibles
                </TableCell>
              </TableRow>
            ) : (
              results.map((result) => (
                <TableRow key={`${result.id}-${result.prompt?.id ?? result.id}`} className="hover:bg-primary-50/60">
                  <TableCell className="max-w-xs text-foreground">
                    <span className="block truncate" title={result.prompt?.promptText ?? ''}>
                      {result.prompt?.promptText ?? '—'}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-mono text-muted-foreground/80" title={`promptId: ${result.prompt?.id ?? 'n/a'}`}>
                      id: {(result.prompt?.id ?? '').slice(0, 8)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{result.prompt.category?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {result.top3Json.map((entry) => (
                        <div key={entry.position} className="text-sm text-muted-foreground">
                          {entry.position}. {entry.name} ({entry.type})
                          {entry.reason && (
                            <span className="block pl-4 text-xs text-muted-foreground/90">
                              — {entry.reason}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-foreground">
                      {(result.score * 100).toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(result.flags)
                        .filter(([, value]) => value)
                        .map(([key]) => (
                          <span
                            key={key}
                            className="rounded bg-primary-50 px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {key}
                          </span>
                        ))}
                      {result.manualOverride && (
                        <span className="rounded bg-accent-50 px-2 py-0.5 text-xs text-accent-700">
                          override
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {runId ? (
                      <Link href={`/runs/${runId}/result/${result.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-foreground hover:bg-primary-50"
                        >
                          Ver
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
                        Ver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
