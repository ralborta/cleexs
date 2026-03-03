'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricItem } from '../types';
import { cn } from '@/lib/utils';

interface MetricsCardProps {
  items: MetricItem[];
  className?: string;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function MetricsCard({ items, className }: MetricsCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/40 to-white shadow-sm',
        className
      )}
    >
      <CardHeader className="relative pb-2 pl-5">
        <CardTitle className="text-base font-bold text-slate-800">Métricas del análisis</CardTitle>
        <CardDescription className="text-sm text-slate-500">
          Coherencia, visibilidad y ranking en esta corrida
        </CardDescription>
      </CardHeader>
      <CardContent className="relative pl-5 pt-0">
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                {item.id}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="tabular-nums text-slate-600">{item.value}%</span>
                </div>
                <ProgressBar value={item.value} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
