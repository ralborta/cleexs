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
        <CardTitle className="text-lg font-semibold text-gray-900">Percepción de marca</CardTitle>
        </div>
        <CardDescription className="text-sm text-gray-600 mt-1">
          Opcional: cómo describen a tu marca (atributos principales)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {attributes.map((attr, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{attr.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{attr.count.toLocaleString()}</span>
                  <span className="text-gray-500">-</span>
                  <span className="font-semibold text-gray-700">{attr.percentage}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${attr.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
