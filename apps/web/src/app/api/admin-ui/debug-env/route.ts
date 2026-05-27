import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ADMIN_DEMO_BYPASS_present: typeof process.env.ADMIN_DEMO_BYPASS !== 'undefined',
    ADMIN_DEMO_BYPASS_raw_length: process.env.ADMIN_DEMO_BYPASS?.length ?? null,
    ADMIN_DEMO_BYPASS_raw_first8: process.env.ADMIN_DEMO_BYPASS?.slice(0, 8) ?? null,
    ADMIN_DEMO_BYPASS_trimmed: process.env.ADMIN_DEMO_BYPASS?.trim() ?? null,
    NEXT_PUBLIC_ADMIN_DEMO_BYPASS_present:
      typeof process.env.NEXT_PUBLIC_ADMIN_DEMO_BYPASS !== 'undefined',
    nodeEnv: process.env.NODE_ENV,
  });
}
