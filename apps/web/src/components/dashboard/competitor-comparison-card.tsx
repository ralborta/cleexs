'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/ui/brand-logo';
import { BarChart3 } from 'lucide-react';
import type { BrandDashboardComparisonRow } from '@/lib/api';

interface CompetitorComparisonCardProps {
  data?: BrandDashboardComparisonRow[];
  brandDomain?: string | null;
}

export function CompetitorComparisonCard({
  data = [],
  brandDomain,
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
              <div key={`${item.name}-${item.type}-${index}`} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <BrandLogo
                      name={item.name}
                      domain={item.type === 'brand' ? brandDomain : undefined}
                      size={28}
                      className="ring-1 ring-primary-100"
                    />
                    <span className="font-medium text-foreground truncate">
                      {item.name}
                      <span className="ml-2 text-xs text-muted-foreground">({item.type === 'brand' ? 'tu marca' : 'competidor'})</span>
                    </span>
                  </div>
                  <span className="font-semibold text-foreground shrink-0">{item.share.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-primary-50 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500"
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
