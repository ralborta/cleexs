import { NextResponse } from 'next/server';
import { getAdminUiSession, getEffectiveAdminRole } from '@/lib/admin-api';
import { ADMIN_ROLE_LABEL } from '@/lib/admin-roles';

export async function GET(request: Request) {
  const session = getAdminUiSession(request);
  const role = getEffectiveAdminRole(request);

  return NextResponse.json({
    authenticated: Boolean(session),
    role,
    roleLabel: ADMIN_ROLE_LABEL[role],
    username: session?.username ?? null,
  });
}
