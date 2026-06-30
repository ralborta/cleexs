'use client';

import { PlanConquistarReportView } from '@/components/reportes/plan-conquistar-report-view';

export function PlanConquistarReportPublicClient({ runId }: { runId: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <PlanConquistarReportView runId={runId} variant="public" />
      </div>
    </main>
  );
}
