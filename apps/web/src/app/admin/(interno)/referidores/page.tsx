'use client';

import { useCallback, useState } from 'react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { ReferidoresDashboard } from '@/components/referidores/referidores-dashboard';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

export const dynamic = 'force-dynamic';

export default function AdminReferidoresPage() {
  const [authError, setAuthError] = useState<string | null>(null);

  const fetcher = useCallback((path: string, init?: RequestInit) => adminUiFetch(path, init), []);

  const onError = useCallback((message: string | null) => {
    setAuthError(message);
  }, []);

  if (authError && looksLikeAdminAuthError(authError)) {
    return <AdminAuthExpiredCard />;
  }

  return (
    <ReferidoresDashboard
      apiBase="/api/admin-ui/referrals"
      fetcher={fetcher}
      onError={onError}
    />
  );
}
