'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

interface Attribute {
  name: string;
  count: number;
  percentage: number;
}

interface BrandPerceptionCardProps {
  attributes?: Attribute[];
}

const mockAttributes: Attribute[] = [
  { name: 'Premium', count: 1480, percentage: 22.6 },
  { name: 'Innovador', count: 1030, percentage: 22.7 },
  { name: 'Rentable', count: 987, percentage: 21.8 },
  { name: 'Confiable', count: 856, percentage: 18.9 },
  { name: 'Fácil de usar', count: 743, percentage: 16.4 },
];

export function BrandPerceptionCard({ attributes = mockAttributes }: BrandPerceptionCardProps) {
  return (
    <Card className="border-transparent bg-white shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg font-semibold text-foreground">Percepción de marca</CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground mt-1">
          Opcional: cómo describen a tu marca (atributos principales)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {attributes.map((attr, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{attr.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{attr.count.toLocaleString()}</span>
                  <span className="text-muted-foreground">({attr.percentage}%)</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(attr.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
