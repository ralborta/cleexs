'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PRIAReport } from '@/lib/api';

interface TrendChartProps {
  data: PRIAReport[];
  brandName?: string;
}

export function TrendChart({ data, brandName }: TrendChartProps) {
  const chartData = data.map((report) => ({
    fecha: new Date(report.run.periodStart).toLocaleDateString('es-AR', {
      month: 'short',
      year: 'numeric',
    }),
    PRIA: report.priaTotal,
    marca: brandName || report.run.brand.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia PRIA</CardTitle>
        <CardDescription>Evolución del índice PRIA en el tiempo</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="PRIA" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
