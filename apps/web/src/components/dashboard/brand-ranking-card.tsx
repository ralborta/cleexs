'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { RankingEntry } from '@/lib/api';

interface BrandRankingCardProps {
  data: RankingEntry[];
  title?: string;
  showCompetitors?: boolean;
}

export function BrandRankingCard({
  data,
  title = 'Ranking de marcas',
  showCompetitors = false,
}: BrandRankingCardProps) {
  return (
    <Card className="border-transparent bg-white shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-700" />
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        </div>
        {showCompetitors && (
          <CardDescription className="text-sm text-gray-600 mt-1">
            Compará tu PRIA con tus principales competidores.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-gray-50/70">
              <TableHead className="w-[50px] text-gray-600 font-medium">#</TableHead>
              <TableHead className="text-gray-600 font-medium">Marca</TableHead>
              <TableHead className="text-right text-gray-600 font-medium">PRIA</TableHead>
              <TableHead className="text-right text-gray-600 font-medium">Ranking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  No hay datos disponibles
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry, index) => {
                // Mock data para cambios (en producción vendría de la API)
                const change = Math.floor(Math.random() * 10) - 5;
                const isPositive = change > 0;

                return (
                  <TableRow key={entry.brandId} className="hover:bg-gray-50/70">
                    <TableCell className="font-medium text-gray-900">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-semibold">
                          {entry.brandName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{entry.brandName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold text-gray-900">
                          {entry.pria.toFixed(0)}
                        </span>
                        {change !== 0 && (
                          <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>{Math.abs(change)}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium text-gray-900">#{index + 1}</span>
                        {index < 3 && (
                          <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {!showCompetitors && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
            <div className="h-5 w-5 rounded bg-gray-200 flex items-center justify-center">
              <span className="text-xs">O</span>
            </div>
            <span>OpenAI</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
