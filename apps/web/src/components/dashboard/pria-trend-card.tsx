'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PRIAReport } from '@/lib/api';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface PRIATrendCardProps {
  data: PRIAReport[];
  brandName?: string;
}

export function PRIATrendCard({ data, brandName }: PRIATrendCardProps) {
  const [timeRange, setTimeRange] = useState('Últimos 30 días');

  // Preparar datos para el gráfico
  const chartData = data.map((report) => ({
    fecha: new Date(report.run.periodStart).toLocaleDateString('es-AR', {
      month: 'short',
      day: 'numeric',
    }),
    PRIA: report.priaTotal,
  }));

  // Calcular PRIA actual y cambio
  const currentPRIA = data.length > 0 ? data[data.length - 1].priaTotal : 0;
  const previousPRIA = data.length > 1 ? data[data.length - 2].priaTotal : currentPRIA;
  const change = currentPRIA - previousPRIA;
  const isPositive = change >= 0;

  return (
    <Card className="border-transparent bg-white shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">Tendencia PRIA</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Métricas principales */}
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-primary-700">
                PRIA actual: {currentPRIA.toFixed(0)}%
              </span>
            </div>
            {change !== 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isPositive ? 'Subió' : 'Bajó'} {Math.abs(change).toFixed(0)} frente al mes pasado
                </span>
                <span className={`text-sm font-semibold ${isPositive ? 'text-primary-700' : 'text-destructive'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(0)}
                </span>
              </div>
            )}
          </div>

          {/* Gráfico */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="fecha"
                  stroke="#475569"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#475569"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="PRIA"
                  stroke="#2563EB"
                  strokeWidth={3}
                  dot={{ fill: '#2563EB', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Descripción y selector */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">Analizá cómo avanza tu PRIA en IA</p>
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
