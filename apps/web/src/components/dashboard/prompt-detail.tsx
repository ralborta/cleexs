'use client';

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
import { Fragment, useState } from 'react';

interface PromptResult {
  id: string;
  prompt: {
    id: string;
    promptText: string;
    category?: { name: string };
  };
  responseText: string;
  top3Json: Array<{ position: number; name: string; type: string }>;
  score: number;
  flags: Record<string, boolean>;
  truncated: boolean;
  manualOverride: boolean;
}

interface PromptDetailProps {
  results: PromptResult[];
}

export function PromptDetail({ results }: PromptDetailProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card className="border-transparent bg-white shadow-md">
      <CardHeader>
        <CardTitle className="text-xl text-foreground">Detalle por Prompt</CardTitle>
        <CardDescription className="text-muted-foreground">
          Resultados y evidencia por cada consulta
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
                <Fragment key={result.id}>
                  <TableRow className="hover:bg-primary-50/60">
                    <TableCell className="max-w-xs truncate text-foreground">
                      {result.prompt.promptText}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{result.prompt.category?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {result.top3Json.map((entry) => (
                          <div key={entry.position} className="text-sm text-muted-foreground">
                            {entry.position}. {entry.name} ({entry.type})
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground hover:bg-primary-50"
                        onClick={() =>
                          setExpandedId(expandedId === result.id ? null : result.id)
                        }
                      >
                        {expandedId === result.id ? 'Ocultar' : 'Ver'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === result.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-primary-50/60">
                        <div className="space-y-2 p-4">
                          <div>
                            <strong>Prompt:</strong>
                            <p className="text-sm text-muted-foreground">{result.prompt.promptText}</p>
                          </div>
                          <div>
                            <strong>Respuesta:</strong>
                            <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs text-muted-foreground">
                              {result.responseText}
                              {result.truncated && (
                                <span className="text-muted-foreground">... (truncado)</span>
                              )}
                            </pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
