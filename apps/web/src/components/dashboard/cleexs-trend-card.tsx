'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { PRIAReport } from '@/lib/api';
import { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';

interface CleexsTrendCardProps {
  data: PRIAReport[];
  brandName?: string;
}

export function CleexsTrendCard({ data, brandName }: CleexsTrendCardProps) {
  const [timeRange, setTimeRange] = useState('Últimos 30 días');

  // Preparar datos para el gráfico (priaTotal = Cleexs Score en backend)
  const chartData = data.map((report) => ({
    fecha: new Date(report.run.periodStart).toLocaleDateString('es-AR', {
      month: 'short',
      day: 'numeric',
    }),
    score: report.priaTotal,
  }));

  const currentScore = data.length > 0 ? data[data.length - 1].priaTotal : 0;
  const previousScore = data.length > 1 ? data[data.length - 2].priaTotal : currentScore;
  const change = currentScore - previousScore;
  const isPositive = change >= 0;

  return (
    <Card className="border-transparent bg-white shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">Tendencia Cleexs Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Métricas principales - estilo similar a imagen */}
          <div>
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold text-foreground">
                Cleexs Score actual: {currentScore.toFixed(0)}
              </span>
              {change !== 0 && (
                <span className={`inline-flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isPositive ? 'Subió' : 'Bajó'} {isPositive ? '+' : ''}{change.toFixed(0)} frente al mes pasado
                </span>
              )}
            </div>
          </div>

          {/* Gráfico con gradiente y área */}
          <div className="h-[200px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cleexsScoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: number) => [value.toFixed(0), 'Cleexs Score']}
                />
                <ReferenceLine y={currentScore} stroke="#6366f1" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#cleexsScoreGradient)"
                  dot={{ fill: '#6366f1', r: 3, strokeWidth: 2, stroke: 'white' }}
                  activeDot={{ r: 5, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Descripción y selector */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">Analizá cómo avanza tu Cleexs Score en IA</p>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="appearance-none bg-white border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                <option>Últimos 7 días</option>
                <option>Últimos 30 días</option>
                <option>Últimos 90 días</option>
                <option>Último año</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
