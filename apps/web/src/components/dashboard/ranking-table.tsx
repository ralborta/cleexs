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
import { RankingEntry } from '@/lib/api';

interface RankingTableProps {
  data: RankingEntry[];
}

export function RankingTable({ data }: RankingTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking Cleexs Score</CardTitle>
        <CardDescription>Comparación de marcas por Cleexs Score</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="text-right">Cleexs Score</TableHead>
              <TableHead className="text-right">Período</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No hay datos disponibles
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry, index) => (
                <TableRow key={entry.brandId}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{entry.brandName}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold">{entry.pria.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(entry.periodStart).toLocaleDateString('es-AR')} -{' '}
                    {new Date(entry.periodEnd).toLocaleDateString('es-AR')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
