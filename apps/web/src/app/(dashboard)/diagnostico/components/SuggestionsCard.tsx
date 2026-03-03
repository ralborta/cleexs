'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ComparisonRow, SuggestionItem } from '../types';
import { cn } from '@/lib/utils';

interface SuggestionsCardProps {
  comparaciones: ComparisonRow[];
  sugerencias: SuggestionItem[];
  className?: string;
}

export function SuggestionsCard({ comparaciones, sugerencias, className }: SuggestionsCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50/40 to-white shadow-sm',
        className
      )}
    >
      <CardHeader className="relative pb-2 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Comparaciones y sugerencias
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Dónde ganás / perdés y qué hacer ahora
            </CardDescription>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Top3
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4 pl-5 pt-0">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 hover:bg-transparent">
              <TableHead className="text-slate-600">Marca</TableHead>
              <TableHead className="text-slate-600">Tipo</TableHead>
              <TableHead className="text-slate-600">Apar.</TableHead>
              <TableHead className="text-slate-600">% Top3</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparaciones.map((row) => (
              <TableRow key={row.marca} className="border-slate-100">
                <TableCell className="font-medium text-slate-700">{row.marca}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      row.tipo === 'marca'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {row.tipo === 'marca' ? 'marca' : 'competidor'}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums text-slate-700">{row.apariciones}</TableCell>
                <TableCell className="tabular-nums text-slate-600">{row.pctTop3}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sugerencias.length > 0 && (
          <div className="rounded-lg border border-sky-100 bg-sky-50/80 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Sugerencias rápidas</p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {sugerencias.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sky-500">•</span>
                  <span>
                    {s.highlights && s.highlights.length > 0
                      ? (() => {
                          const parts: React.ReactNode[] = [];
                          let remaining = s.text;
                          let key = 0;
                          for (const h of s.highlights) {
                            const idx = remaining.indexOf(h);
                            if (idx >= 0) {
                              parts.push(remaining.slice(0, idx));
                              parts.push(
                                <strong key={`${i}-${key++}`} className="font-semibold text-slate-800">
                                  {h}
                                </strong>
                              );
                              remaining = remaining.slice(idx + h.length);
                            }
                          }
                          if (remaining) parts.push(remaining);
                          return parts.length ? parts : s.text;
                        })()
                      : s.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
