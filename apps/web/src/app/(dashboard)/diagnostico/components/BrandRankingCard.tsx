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
import type { BrandRankRow } from '../types';
import { cn } from '@/lib/utils';

interface BrandRankingCardProps {
  rows: BrandRankRow[];
  /** Cantidad a mostrar (ej. Top 6). Por defecto 6. */
  topN?: number;
  className?: string;
}

const ACCENT_CLASS = 'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-blue-400';

export function BrandRankingCard({ rows, topN = 6, className }: BrandRankingCardProps) {
  const displayRows = rows.slice(0, topN);

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl border-0 border-l-4 border-blue-400 bg-white shadow-sm',
        className
      )}
    >
      <div className={ACCENT_CLASS} aria-hidden />
      <CardHeader className="relative pb-2 pl-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Ranking de marcas</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Comparación por visibilidad en recomendaciones
            </CardDescription>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Top {topN}
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative pl-6 pt-0">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 hover:bg-transparent">
              <TableHead className="text-slate-600">#</TableHead>
              <TableHead className="text-slate-600">Marca</TableHead>
              <TableHead className="text-slate-600">Score</TableHead>
              <TableHead className="text-slate-600">% Top3</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row) => (
              <TableRow key={row.rank} className="border-slate-100">
                <TableCell className="font-medium text-slate-700">{row.rank}</TableCell>
                <TableCell className="text-slate-700">{row.marca}</TableCell>
                <TableCell className="tabular-nums text-slate-700">{row.score}</TableCell>
                <TableCell className="tabular-nums text-slate-600">{row.pctTop3}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
