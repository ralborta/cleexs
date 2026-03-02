'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { IntencionItem } from '../types';
import { cn } from '@/lib/utils';
import { ArrowLeftRight } from 'lucide-react';

interface IntentCardProps {
  items: IntencionItem[];
  className?: string;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-amber-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function IntentCard({ items, className }: IntentCardProps) {
  const chartData = items.map((i) => ({ name: i.label, value: i.value, fullName: i.label }));

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-white shadow-sm',
        className
      )}
    >
      <CardHeader className="relative pb-2 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Por intención</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Distribución del score por intención
            </CardDescription>
          </div>
          <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <ArrowLeftRight className="h-3 w-3" />
            Intent mix
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4 pl-5 pt-0">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="tabular-nums text-slate-600">{item.value}%</span>
              </div>
              <ProgressBar value={item.value} />
            </div>
          ))}
        </div>
        {chartData.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Comparación rápida</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [v, '%']}
                />
                <Bar dataKey="value" fill="rgb(245, 158, 11)" radius={[4, 4, 0, 0]} name="%" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
