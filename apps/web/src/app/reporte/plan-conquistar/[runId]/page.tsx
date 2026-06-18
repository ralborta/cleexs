import type { Metadata } from 'next';
import { PlanConquistarReportPublicClient } from './report-public-client';

export const metadata: Metadata = {
  title: 'Informe Cleexs · Plan Conquistar',
  robots: { index: false, follow: false },
};

export default function PlanConquistarPublicReportPage({ params }: { params: { runId: string } }) {
  return <PlanConquistarReportPublicClient runId={params.runId} />;
}
