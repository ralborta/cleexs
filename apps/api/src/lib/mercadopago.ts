import crypto from 'crypto';
import { MercadoPagoConfig, Payment, PreApproval, Preference } from 'mercadopago';
import type { FastifyRequest } from 'fastify';

let client: MercadoPagoConfig | null = null;

export function getMercadoPagoClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN no configurado.');
  }

  if (!client || client.accessToken !== accessToken) {
    client = new MercadoPagoConfig({ accessToken });
  }

  return client;
}

export function getPreApprovalClient() {
  return new PreApproval(getMercadoPagoClient());
}

export function getPaymentClient() {
  return new Payment(getMercadoPagoClient());
}

export function getPreferenceClient() {
  return new Preference(getMercadoPagoClient());
}

export function getPublicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

/** Credenciales TEST de MP usan token `TEST-…`; producción usa `APP_USR-…`. */
export function isMercadoPagoTestMode() {
  const token = process.env.MP_ACCESS_TOKEN?.trim() ?? '';
  return token.startsWith('TEST-');
}

/** En producción prioriza `init_point`; en sandbox, `sandbox_init_point`. */
export function resolveMercadoPagoCheckoutUrl(links: {
  init_point?: string | null;
  sandbox_init_point?: string | null;
}) {
  const initPoint = links.init_point?.trim() || null;
  const sandboxInitPoint = links.sandbox_init_point?.trim() || null;
  if (isMercadoPagoTestMode()) {
    return sandboxInitPoint ?? initPoint;
  }
  return initPoint ?? sandboxInitPoint;
}

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function extractSignatureParts(signature: string) {
  return Object.fromEntries(
    signature
      .split(',')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
  );
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyMercadoPagoWebhookSignature(request: FastifyRequest, resourceId?: string | number | null) {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error('MP_WEBHOOK_SECRET no configurado.');
  }

  const signature = header(request, 'x-signature');
  const requestId = header(request, 'x-request-id');
  if (!signature || !requestId || resourceId == null || resourceId === '') return false;

  const parts = extractSignatureParts(signature);
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return safeEqualHex(expected, v1);
}
