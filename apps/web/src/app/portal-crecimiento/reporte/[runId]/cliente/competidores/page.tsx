'use client';

import { useParams } from 'next/navigation';
import { PortalCompetidoresCleexsScore } from '@/components/portal/portal-competidores-cleexs-score';

export default function PortalCrecimientoClienteCompetidoresPage() {
  const params = useParams();
  const runId = params.runId as string;
  return <PortalCompetidoresCleexsScore runId={runId} shell="portal-crecimiento-cliente" />;
}
