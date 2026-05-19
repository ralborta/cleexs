import { NextResponse } from 'next/server';
import { fetchCleexsApiServer } from '@/lib/cleexs-api-server';

/** Proxy same-origin para /tools/auspiciadores (evita CORS y URLs de API rotas en el cliente). */
export async function GET() {
  try {
    const res = await fetchCleexsApiServer('/api/reports/platform-dashboard', { method: 'GET' });
    const text = await res.text();
    if (!res.ok) {
      let message = `La API respondió ${res.status}`;
      try {
        const j = JSON.parse(text) as { error?: string; message?: string };
        message = j.error || j.message || message;
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: message }, { status: res.status >= 400 ? res.status : 502 });
    }
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo conectar con la API';
    return NextResponse.json(
      {
        error: `${msg}. Revisá API_URL o NEXT_PUBLIC_API_URL en Vercel (URL del backend en Railway).`,
      },
      { status: 503 }
    );
  }
}
