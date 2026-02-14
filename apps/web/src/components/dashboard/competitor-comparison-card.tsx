'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import type { BrandDashboardComparisonRow } from '@/lib/api';

interface CompetitorComparisonCardProps {
  data?: BrandDashboardComparisonRow[];
}

export function CompetitorComparisonCard({
  data = [],
}: CompetitorComparisonCardProps) {
  return (
    <Card className="border-transparent bg-white shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary-700" />
          <CardTitle className="text-lg font-semibold text-foreground">Comparación con competidores</CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground mt-1">
          % de apariciones en el Top 3 por marca (tu marca vs competidores).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay datos de comparación todavía.</p>
          ) : (
            data.map((item, index) => (
              <div key={`${item.name}-${item.type}-${index}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {item.name}
                    <span className="ml-2 text-xs text-muted-foreground">({item.type === 'brand' ? 'tu marca' : 'competidor'})</span>
                  </span>
                  <span className="font-semibold text-foreground">{item.share.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-primary-50 rounded-full h-2.5">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min(item.share, 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
