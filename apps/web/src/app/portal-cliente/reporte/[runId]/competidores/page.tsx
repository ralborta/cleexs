'use client';

import { useParams } from 'next/navigation';
import { PortalCompetidoresCleexsScore } from '@/components/portal/portal-competidores-cleexs-score';

export default function PortalClienteCompetidoresPage() {
  const params = useParams();
  const runId = params.runId as string;
  return <PortalCompetidoresCleexsScore runId={runId} shell="portal-cliente" />;
}
