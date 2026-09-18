'use client';

import { ReportesHub } from '@/components/reportes/reportes-hub';

export default function AdminReportesPage() {
  return (
    <ReportesHub
      variants={[
        'adquisicion',
        'onboarding',
        'cleexs-score',
        'email-outreach',
        'plan-conquistar',
      ]}
    />
  );
}
