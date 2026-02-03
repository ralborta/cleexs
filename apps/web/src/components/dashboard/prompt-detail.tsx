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
import { useState } from 'react';

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
        <CardTitle className="text-xl text-gray-900">Detalle por Prompt</CardTitle>
        <CardDescription className="text-gray-600">
          Resultados y evidencia por cada consulta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-gray-600">Prompt</TableHead>
              <TableHead className="text-gray-600">Categoría</TableHead>
              <TableHead className="text-gray-600">Top 3</TableHead>
              <TableHead className="text-right text-gray-600">Score</TableHead>
              <TableHead className="text-gray-600">Flags</TableHead>
              <TableHead className="text-gray-600">Evidencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                  No hay resultados disponibles
                </TableCell>
              </TableRow>
            ) : (
              results.map((result) => (
                <>
                  <TableRow key={result.id} className="hover:bg-slate-50/80">
                    <TableCell className="max-w-xs truncate text-gray-900">
                      {result.prompt.promptText}
                    </TableCell>
                    <TableCell className="text-gray-600">{result.prompt.category?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {result.top3Json.map((entry) => (
                          <div key={entry.position} className="text-sm text-gray-700">
                            {entry.position}. {entry.name} ({entry.type})
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-gray-900">
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
                              className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                            >
                              {key}
                            </span>
                          ))}
                        {result.manualOverride && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                            override
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-700 hover:bg-slate-100"
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
                      <TableCell colSpan={6} className="bg-slate-50/80">
                        <div className="space-y-2 p-4">
                          <div>
                            <strong>Prompt:</strong>
                            <p className="text-sm text-gray-600">{result.prompt.promptText}</p>
                          </div>
                          <div>
                            <strong>Respuesta:</strong>
                            <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs text-gray-700">
                              {result.responseText}
                              {result.truncated && (
                                <span className="text-gray-500">... (truncado)</span>
                              )}
                            </pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
