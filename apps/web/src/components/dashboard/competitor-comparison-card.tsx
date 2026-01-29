'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface CategoryComparison {
  category: string;
  percentage: number;
}

interface CompetitorComparisonCardProps {
  data?: CategoryComparison[];
}

const mockData: CategoryComparison[] = [
  { category: 'Mejores plataformas de inversión', percentage: 75 },
  { category: 'Invertir dinero en 2024', percentage: 51 },
  { category: 'Cuál es el mejor broker online', percentage: 47 },
  { category: 'Apps de trading para principiantes', percentage: 38 },
  { category: 'Cómo empezar a invertir', percentage: 32 },
];

export function CompetitorComparisonCard({
  data = mockData,
}: CompetitorComparisonCardProps) {
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-700" />
          <CardTitle className="text-lg font-semibold text-gray-900">Brand Ranking</CardTitle>
        </div>
        <CardDescription className="text-sm text-gray-600 mt-1">
          Compará tu PRIA con tus principales competidores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.category}</span>
                <span className="font-semibold text-gray-900">{item.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
