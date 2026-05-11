import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ScoreShareClient } from './score-share-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function siteBase(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (u) return u;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://cleexs.net';
}

async function fetchShareMeta(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/public/diagnostic/share/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      brandName: string;
      cleexsScore: number | null;
      resumenTeaser: string;
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const meta = await fetchShareMeta(params.slug);
  const base = siteBase();
  const url = `${base}/score/${encodeURIComponent(params.slug)}`;
  if (!meta) {
    return { title: 'Cleexs Score', robots: { index: false } };
  }
  const title = `Cleexs Score — ${meta.brandName}`;
  const teaser = (meta.resumenTeaser || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const desc =
    meta.cleexsScore != null
      ? `${meta.brandName}: score ${Math.round(meta.cleexsScore)}/100. ${teaser}`
      : `Diagnóstico Cleexs de ${meta.brandName}. ${teaser}`;
  const description = desc.slice(0, 160);
  return {
    title,
    description,
    openGraph: {
      title,
      description: description.slice(0, 200),
      url,
      siteName: 'Cleexs',
      type: 'website',
      locale: 'es_AR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description.slice(0, 200),
    },
  };
}

export default function ScoreSharePage({ params }: { params: { slug: string } }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
        </main>
      }
    >
      <ScoreShareClient slug={params.slug} />
    </Suspense>
  );
}
