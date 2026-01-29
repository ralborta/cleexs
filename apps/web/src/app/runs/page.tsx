'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { runsApi, Run } from '@/lib/api';
import { PromptDetail } from '@/components/dashboard/prompt-detail';

const MOCK_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRuns() {
      try {
        const data = await runsApi.list(MOCK_TENANT_ID);
        setRuns(data);
      } catch (error) {
        console.error('Error cargando runs:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRuns();
  }, []);

  const handleViewDetails = async (run: Run) => {
    try {
      const fullRun = await runsApi.get(run.id);
      setSelectedRun(fullRun as any);
    } catch (error) {
      console.error('Error cargando detalles:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Runs</h1>
          <p className="text-muted-foreground">Gestiona y visualiza tus corridas de análisis</p>
        </div>
        <Link href="/runs/add-result">
          <Button>Agregar Resultado Manual</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Runs</CardTitle>
          <CardDescription>Corridas de análisis por marca y período</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">PRIA</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay runs disponibles
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{run.brand.name}</TableCell>
                    <TableCell>
                      {new Date(run.periodStart).toLocaleDateString('es-AR')} -{' '}
                      {new Date(run.periodEnd).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          run.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : run.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {run.priaReports && run.priaReports[0] ? (
                        <span className="font-semibold">
                          {run.priaReports[0].priaTotal.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(run)}>
                        Ver Detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRun && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalles del Run</CardTitle>
              <CardDescription>
                {selectedRun.brand.name} -{' '}
                {new Date(selectedRun.periodStart).toLocaleDateString('es-AR')} a{' '}
                {new Date(selectedRun.periodEnd).toLocaleDateString('es-AR')}
              </CardDescription>
            </CardHeader>
          </Card>
          {(selectedRun as any).promptResults && (
            <PromptDetail results={(selectedRun as any).promptResults} />
          )}
        </div>
      )}
    </div>
  );
}
