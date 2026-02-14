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
import { BrandLogo } from '@/components/ui/brand-logo';
import { BarChart3 } from 'lucide-react';
import { RankingEntry } from '@/lib/api';

type RankingEntryWithLogo = RankingEntry & { domain?: string | null };

interface BrandRankingCardProps {
  data: RankingEntryWithLogo[];
  title?: string;
  showCompetitors?: boolean;
  scoreColumnLabel?: string;
}

export function BrandRankingCard({
  data,
  title = 'Ranking de marcas',
  showCompetitors = false,
  scoreColumnLabel,
}: BrandRankingCardProps) {
  const scoreLabel = scoreColumnLabel ?? (showCompetitors ? '% en Top 3' : 'Cleexs Score');
  return (
    <Card className="border-transparent bg-white shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary-700" />
          <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        </div>
        {showCompetitors && (
          <CardDescription className="text-sm text-muted-foreground mt-1">
            Compará tu Cleexs Score con tus principales competidores.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-primary-50/80">
              <TableHead className="w-[50px] text-muted-foreground font-medium">#</TableHead>
              <TableHead className="text-muted-foreground font-medium">Marca</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium">{scoreLabel}</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium">Ranking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No hay datos disponibles
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry, index) => (
                  <TableRow key={entry.brandId} className="hover:bg-primary-50/60">
                    <TableCell className="font-medium text-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <BrandLogo
                          name={entry.brandName}
                          domain={entry.domain}
                          size={32}
                          className="ring-1 ring-primary-100"
                        />
                        <span className="font-medium text-foreground">{entry.brandName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-foreground">
                        {entry.pria.toFixed(showCompetitors ? 1 : 0)}
                        {showCompetitors && '%'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-foreground">#{index + 1}</span>
                      {index < 3 && (
                        <span className="ml-1 inline-block h-2 w-2 rounded-full bg-accent-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>

        {!showCompetitors && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-5 w-5 rounded bg-primary-50 flex items-center justify-center">
              <span className="text-xs font-medium text-primary-700">O</span>
            </div>
            <span>OpenAI</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
