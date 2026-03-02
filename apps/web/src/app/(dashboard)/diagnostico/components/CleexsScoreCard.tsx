'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CleexsScoreData } from '../types';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

interface CleexsScoreCardProps {
  data: CleexsScoreData;
  className?: string;
}

const ACCENT_CLASS = 'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-violet-400';

function MiniProgress({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-700">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function CleexsScoreCard({ data, className }: CleexsScoreCardProps) {
  const { score, vsLastMonth, ponderadoPor, modelo, miniMetricas, tendencia } = data;

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl border-0 border-l-4 border-violet-400 bg-white shadow-sm',
        className
      )}
    >
      <div className={ACCENT_CLASS} aria-hidden />
      <CardHeader className="relative pb-1 pl-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Cleexs Score</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Probabilidad de ser elegido por IA (0-100)
            </CardDescription>
          </div>
          {vsLastMonth != null && vsLastMonth !== 0 && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
              +{vsLastMonth} vs mes pasado
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4 pl-6 pt-2">
        <div className="flex flex-col items-center rounded-xl border-2 border-violet-100 bg-gradient-to-br from-violet-50 to-primary-50/80 p-4 shadow-inner">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Cleexs actual
          </span>
          <span className="mt-1 text-4xl font-bold tabular-nums text-violet-700">{score}</span>
          <span className="mt-1 text-xs text-slate-500">
            Ponderado por {ponderadoPor} · Modelo: {modelo}
          </span>
        </div>
        {miniMetricas.length > 0 && (
          <div className="space-y-3">
            {miniMetricas.map((m) => (
              <MiniProgress key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
        )}
        {tendencia.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Tendencia (últimos 6 meses)</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={tendencia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [v, 'Score']}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="rgb(139, 92, 246)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
