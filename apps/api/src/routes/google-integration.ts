/* eslint-disable no-console */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  isGoogleOAuthConfigured,
  refreshAccessToken,
  revokeRefreshToken,
} from '../lib/google-oauth';
import {
  encryptGoogleToken,
  decryptGoogleToken,
  isGoogleTokenCryptoConfigured,
} from '../lib/google-token-crypto';
import {
  listGA4Properties,
  runAITrafficReport,
  type AITrafficRow,
} from '../lib/google-analytics-data';
import { resolvePlanKey } from '../lib/entitlements';

/**
 * Integración Google Analytics (GA4) + Search Console para portal Premium.
 *
 * Flujo:
 *   1) Cliente premium clickea "Conectar Google" -> POST /google/oauth/start (devuelve URL)
 *   2) Cliente vuelve de Google -> GET /google/oauth/callback?code=... -> redirect a frontend
 *   3) Frontend pide /google/properties -> el cliente elige propiedad por brand
 *   4) Frontend pide /google/brands/:brandId/ai-traffic -> ve dashboard
 *
 * Plan gate: solo planes 'crecimiento', 'enterprise' o 'admin' pueden conectar.
 */

const PREMIUM_PLAN_KEYS = new Set(['crecimiento', 'enterprise', 'admin']);

const STATE_TTL_SECONDS = 60 * 15; // 15 minutos para volver de Google

type OAuthState = {
  userId: string;
  tenantId: string;
  brandId?: string;
  returnTo?: string;
  iat: number;
};

function loadStateSecret(): string {
  const s = (process.env.PORTAL_JWT_SECRET || '').trim();
  if (!s) throw new Error('PORTAL_JWT_SECRET no configurado.');
  return s;
}

function signOAuthState(payload: Omit<OAuthState, 'iat'>): string {
  return jwt.sign(payload, loadStateSecret(), {
    expiresIn: STATE_TTL_SECONDS,
    issuer: 'cleexs-google-oauth',
  });
}

function verifyOAuthState(raw: string): OAuthState | null {
  try {
    const decoded = jwt.verify(raw, loadStateSecret(), {
      issuer: 'cleexs-google-oauth',
    }) as jwt.JwtPayload;
    if (typeof decoded.userId !== 'string' || typeof decoded.tenantId !== 'string') return null;
    return {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      brandId: typeof decoded.brandId === 'string' ? decoded.brandId : undefined,
      returnTo: typeof decoded.returnTo === 'string' ? decoded.returnTo : undefined,
      iat: typeof decoded.iat === 'number' ? decoded.iat : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Resuelve el plan del usuario respetando overrides (entitlement_overrides) y
 * el "admin god mode" — exactamente la misma lógica que `/api/me/usage`.
 * Esto evita que un cliente con plan base "free" pero override a "crecimiento"
 * sea bloqueado erróneamente.
 */
async function ensurePremium(actor: { tenantId: string; userId?: string }): Promise<
  | { ok: true; planKey: string }
  | { ok: false; planKey: string; reason: string }
> {
  const planKey = await resolvePlanKey(prisma, actor);
  if (!PREMIUM_PLAN_KEYS.has(planKey)) {
    return { ok: false, planKey, reason: 'plan_premium_requerido' };
  }
  return { ok: true, planKey };
}

function frontendBaseUrl(): string {
  const raw =
    process.env.FRONTEND_URL ||
    (process.env.FRONTEND_URLS || '').split(',').map((s) => s.trim()).filter(Boolean)[0] ||
    'https://cleexs.com';
  return raw.replace(/\/$/, '');
}

function buildReturnUrl(state: OAuthState, status: 'ok' | 'error', detail?: string): string {
  const base = state.returnTo?.startsWith('http')
    ? state.returnTo
    : `${frontendBaseUrl()}${state.returnTo || '/portal-cliente'}`;
  const url = new URL(base);
  url.searchParams.set('google', status);
  if (detail) url.searchParams.set('googleDetail', detail);
  return url.toString();
}

/** Obtiene un access_token usando el refresh almacenado. Marca la integración con error si falla. */
async function getAccessTokenForTenant(tenantId: string): Promise<string> {
  const integ = await prisma.googleIntegration.findUnique({ where: { tenantId } });
  if (!integ) throw new Error('Sin integración Google para este tenant.');
  if (integ.status !== 'active') throw new Error(`Integración Google en estado ${integ.status}.`);
  let refresh: string;
  try {
    refresh = decryptGoogleToken(integ.refreshTokenEncrypted);
  } catch (err: any) {
    throw new Error(`No se pudo descifrar refresh_token: ${err?.message}`);
  }
  try {
    const tk = await refreshAccessToken(refresh);
    return tk.accessToken;
  } catch (err: any) {
    await prisma.googleIntegration.update({
      where: { id: integ.id },
      data: {
        status: 'error',
        lastErrorMessage: String(err?.message || err).slice(0, 1000),
        lastErrorAt: new Date(),
      },
    });
    throw err;
  }
}

/** Persiste filas de runReport en ai_traffic_snapshots agrupando por (date + aiSource). */
async function persistSnapshots(input: {
  propertyId: string;
  brandId: string;
  rows: AITrafficRow[];
}) {
  const { propertyId, brandId, rows } = input;
  // agregamos por (date + aiSource) — sumamos las landings y nos quedamos con la top
  type Key = string;
  type Bucket = {
    date: string;
    aiSource: string;
    sessions: number;
    totalUsers: number;
    newUsers: number;
    conversions: number;
    engagedSessions: number;
    bounceRateSum: number;
    bounceRateCount: number;
    landingCounts: Map<string, number>;
  };
  const acc = new Map<Key, Bucket>();
  for (const r of rows) {
    const key = `${r.date}|${r.aiSource}`;
    let b = acc.get(key);
    if (!b) {
      b = {
        date: r.date,
        aiSource: r.aiSource,
        sessions: 0,
        totalUsers: 0,
        newUsers: 0,
        conversions: 0,
        engagedSessions: 0,
        bounceRateSum: 0,
        bounceRateCount: 0,
        landingCounts: new Map(),
      };
      acc.set(key, b);
    }
    b.sessions += r.sessions;
    b.totalUsers += r.totalUsers;
    b.newUsers += r.newUsers;
    b.conversions += r.conversions;
    b.engagedSessions += r.engagedSessions;
    if (r.bounceRate != null) {
      b.bounceRateSum += r.bounceRate;
      b.bounceRateCount += 1;
    }
    if (r.landingPage) {
      b.landingCounts.set(r.landingPage, (b.landingCounts.get(r.landingPage) || 0) + r.sessions);
    }
  }

  for (const b of acc.values()) {
    const topLanding =
      [...b.landingCounts.entries()].sort((a, z) => z[1] - a[1])[0]?.[0] || null;
    const dateObj = new Date(`${b.date}T00:00:00.000Z`);
    await prisma.aITrafficSnapshot.upsert({
      where: {
        brandId_date_aiSource: {
          brandId,
          date: dateObj,
          aiSource: b.aiSource,
        },
      },
      create: {
        propertyId,
        brandId,
        date: dateObj,
        aiSource: b.aiSource,
        sessions: b.sessions,
        totalUsers: b.totalUsers,
        newUsers: b.newUsers,
        conversions: b.conversions,
        engagedSessions: b.engagedSessions,
        bounceRate: b.bounceRateCount > 0 ? b.bounceRateSum / b.bounceRateCount : null,
        topLandingPage: topLanding,
      },
      update: {
        propertyId,
        sessions: b.sessions,
        totalUsers: b.totalUsers,
        newUsers: b.newUsers,
        conversions: b.conversions,
        engagedSessions: b.engagedSessions,
        bounceRate: b.bounceRateCount > 0 ? b.bounceRateSum / b.bounceRateCount : null,
        topLandingPage: topLanding,
      },
    });
  }
}

const googleIntegrationRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------------------------------------------------------------
  // 1) GET /google/status — info para el tab del portal premium
  // ---------------------------------------------------------------
  fastify.get('/google/status', async (request, reply) => {
    const u = await resolvePortalUserFromRequest(request);
    if (!u) return reply.code(401).send({ error: 'No autenticado.' });

    const premium = await ensurePremium({ tenantId: u.tenantId, userId: u.userId });
    const configured =
      isGoogleOAuthConfigured() && isGoogleTokenCryptoConfigured();

    const integration = await prisma.googleIntegration.findUnique({
      where: { tenantId: u.tenantId },
      include: { properties: true },
    });

    return {
      planKey: premium.ok ? premium.planKey : premium.planKey,
      premium: premium.ok,
      configured,
      integration: integration
        ? {
            id: integration.id,
            googleEmail: integration.googleEmail,
            status: integration.status,
            connectedAt: integration.connectedAt,
            lastErrorMessage: integration.lastErrorMessage,
            lastErrorAt: integration.lastErrorAt,
            propertiesCount: integration.properties.length,
          }
        : null,
    };
  });

  // ---------------------------------------------------------------
  // 2) POST /google/oauth/start — devuelve la URL para redirigir
  // ---------------------------------------------------------------
  fastify.post<{ Body: { brandId?: string; returnTo?: string } }>('/google/oauth/start', async (request, reply) => {
    const u = await resolvePortalUserFromRequest(request);
    if (!u) return reply.code(401).send({ error: 'No autenticado.' });

    const premium = await ensurePremium({ tenantId: u.tenantId, userId: u.userId });
    if (!premium.ok) {
      return reply.code(403).send({
        error: 'plan_premium_requerido',
        message: 'Esta funcionalidad está disponible solo en el plan Crecimiento.',
        planKey: premium.planKey,
      });
    }

    if (!isGoogleOAuthConfigured()) {
      return reply.code(503).send({
        error: 'google_oauth_no_configurado',
        message: 'Falta configurar GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET en la API.',
      });
    }
    if (!isGoogleTokenCryptoConfigured()) {
      return reply.code(503).send({
        error: 'google_crypto_no_configurada',
        message: 'Falta configurar GOOGLE_TOKEN_ENCRYPTION_KEY (64 chars hex) en la API.',
      });
    }

    const body = (request.body ?? {}) as { brandId?: string; returnTo?: string };
    const state = signOAuthState({
      userId: u.userId,
      tenantId: u.tenantId,
      brandId: body.brandId,
      returnTo: body.returnTo,
    });

    const url = buildGoogleAuthUrl({ state, loginHint: u.email });
    return { authorizeUrl: url };
  });

  // ---------------------------------------------------------------
  // 3) GET /google/oauth/callback — Google nos devuelve el code
  // ---------------------------------------------------------------
  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/google/oauth/callback',
    async (request, reply) => {
      const { code, state, error } = request.query;
      if (error) {
        return reply.code(400).send({ error: 'google_consent_denied', detail: error });
      }
      if (!code || !state) {
        return reply.code(400).send({ error: 'missing_code_or_state' });
      }
      const decoded = verifyOAuthState(state);
      if (!decoded) {
        return reply.code(400).send({ error: 'invalid_or_expired_state' });
      }
      const premium = await ensurePremium({ tenantId: decoded.tenantId, userId: decoded.userId });
      if (!premium.ok) {
        return reply.redirect(
          buildReturnUrl(decoded, 'error', 'plan_premium_requerido'),
          302
        );
      }
      try {
        const tokens = await exchangeCodeForTokens(code);
        if (!tokens.refreshToken) {
          // muy raro pero posible si el usuario ya autorizó antes y no forzamos prompt=consent
          return reply.redirect(buildReturnUrl(decoded, 'error', 'sin_refresh_token'), 302);
        }
        const user = await fetchGoogleUserInfo(tokens.accessToken);

        const encrypted = encryptGoogleToken(tokens.refreshToken);

        await prisma.googleIntegration.upsert({
          where: { tenantId: decoded.tenantId },
          create: {
            tenantId: decoded.tenantId,
            googleEmail: user.email,
            googleUserId: user.sub,
            refreshTokenEncrypted: encrypted,
            scopesGranted: tokens.scope,
            status: 'active',
          },
          update: {
            googleEmail: user.email,
            googleUserId: user.sub,
            refreshTokenEncrypted: encrypted,
            scopesGranted: tokens.scope,
            status: 'active',
            lastErrorMessage: null,
            lastErrorAt: null,
          },
        });

        return reply.redirect(buildReturnUrl(decoded, 'ok'), 302);
      } catch (err: any) {
        request.log.error({ err }, 'google_oauth_callback_failed');
        return reply.redirect(
          buildReturnUrl(decoded, 'error', String(err?.message || 'desconocido').slice(0, 120)),
          302
        );
      }
    }
  );

  // ---------------------------------------------------------------
  // 4) POST /google/disconnect
  // ---------------------------------------------------------------
  fastify.post('/google/disconnect', async (request, reply) => {
    const u = await resolvePortalUserFromRequest(request);
    if (!u) return reply.code(401).send({ error: 'No autenticado.' });

    const integ = await prisma.googleIntegration.findUnique({
      where: { tenantId: u.tenantId },
    });
    if (!integ) return { ok: true, alreadyDisconnected: true };

    try {
      const refresh = decryptGoogleToken(integ.refreshTokenEncrypted);
      await revokeRefreshToken(refresh);
    } catch (err) {
      request.log.warn({ err }, 'google_revoke_failed');
    }

    await prisma.googleIntegration.delete({ where: { id: integ.id } });
    return { ok: true };
  });

  // ---------------------------------------------------------------
  // 5) GET /google/properties — lista propiedades GA4 del usuario
  // ---------------------------------------------------------------
  fastify.get('/google/properties', async (request, reply) => {
    const u = await resolvePortalUserFromRequest(request);
    if (!u) return reply.code(401).send({ error: 'No autenticado.' });

    try {
      const accessToken = await getAccessTokenForTenant(u.tenantId);
      const properties = await listGA4Properties(accessToken);
      return { properties };
    } catch (err: any) {
      return reply.code(502).send({
        error: 'google_api_error',
        message: String(err?.message || err),
      });
    }
  });

  // ---------------------------------------------------------------
  // 6) POST /google/properties/select — asocia propiedad a brand
  // ---------------------------------------------------------------
  const selectSchema = z.object({
    brandId: z.string().uuid(),
    propertyId: z.string().regex(/^properties\/\d+$/),
    propertyName: z.string().optional(),
    gscSiteUrl: z.string().optional(),
  });
  fastify.post<{ Body: z.infer<typeof selectSchema> }>(
    '/google/properties/select',
    async (request, reply) => {
      const u = await resolvePortalUserFromRequest(request);
      if (!u) return reply.code(401).send({ error: 'No autenticado.' });

      const parsed = selectSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'payload_invalido', issues: parsed.error.issues });
      }
      const brand = await prisma.brand.findUnique({
        where: { id: parsed.data.brandId },
        select: { id: true, tenantId: true },
      });
      if (!brand) return reply.code(404).send({ error: 'brand_no_encontrada' });
      if (brand.tenantId !== u.tenantId) {
        return reply.code(403).send({ error: 'brand_no_pertenece_al_tenant' });
      }
      const integration = await prisma.googleIntegration.findUnique({
        where: { tenantId: u.tenantId },
      });
      if (!integration) return reply.code(404).send({ error: 'sin_integracion_google' });

      const prop = await prisma.googleAnalyticsProperty.upsert({
        where: { brandId: parsed.data.brandId },
        create: {
          integrationId: integration.id,
          brandId: parsed.data.brandId,
          ga4PropertyId: parsed.data.propertyId,
          ga4PropertyName: parsed.data.propertyName,
          gscSiteUrl: parsed.data.gscSiteUrl,
        },
        update: {
          integrationId: integration.id,
          ga4PropertyId: parsed.data.propertyId,
          ga4PropertyName: parsed.data.propertyName,
          gscSiteUrl: parsed.data.gscSiteUrl,
          lastSyncStatus: null,
          lastSyncError: null,
        },
      });
      return { ok: true, property: prop };
    }
  );

  // ---------------------------------------------------------------
  // 7) GET /google/brands/:brandId/ai-traffic — datos para UI
  // ---------------------------------------------------------------
  fastify.get<{
    Params: { brandId: string };
    Querystring: { days?: string };
  }>('/google/brands/:brandId/ai-traffic', async (request, reply) => {
    const u = await resolvePortalUserFromRequest(request);
    if (!u) return reply.code(401).send({ error: 'No autenticado.' });

    const brandId = request.params.brandId;
    const days = Math.min(180, Math.max(7, Number.parseInt(request.query.days || '30', 10) || 30));
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, tenantId: true, name: true, domain: true },
    });
    if (!brand) return reply.code(404).send({ error: 'brand_no_encontrada' });
    if (brand.tenantId !== u.tenantId) {
      return reply.code(403).send({ error: 'brand_no_pertenece_al_tenant' });
    }
    const property = await prisma.googleAnalyticsProperty.findUnique({
      where: { brandId },
    });

    const snapshots = property
      ? await prisma.aITrafficSnapshot.findMany({
          where: { brandId, date: { gte: since } },
          orderBy: [{ date: 'asc' }, { aiSource: 'asc' }],
        })
      : [];

    // KPIs agregados
    const totals = snapshots.reduce(
      (acc, s) => {
        acc.sessions += s.sessions;
        acc.totalUsers += s.totalUsers;
        acc.conversions += s.conversions;
        return acc;
      },
      { sessions: 0, totalUsers: 0, conversions: 0 }
    );

    // Breakdown por IA
    const bySourceMap = new Map<
      string,
      { aiSource: string; sessions: number; totalUsers: number; conversions: number; topLanding?: string | null }
    >();
    for (const s of snapshots) {
      const cur = bySourceMap.get(s.aiSource) || {
        aiSource: s.aiSource,
        sessions: 0,
        totalUsers: 0,
        conversions: 0,
        topLanding: null,
      };
      cur.sessions += s.sessions;
      cur.totalUsers += s.totalUsers;
      cur.conversions += s.conversions;
      if (s.topLandingPage && !cur.topLanding) cur.topLanding = s.topLandingPage;
      bySourceMap.set(s.aiSource, cur);
    }
    const bySource = [...bySourceMap.values()].sort((a, b) => b.sessions - a.sessions);

    // Serie diaria por IA (para gráfico)
    const seriesMap = new Map<string, Array<{ date: string; sessions: number }>>();
    for (const s of snapshots) {
      const key = s.aiSource;
      const arr = seriesMap.get(key) || [];
      arr.push({ date: s.date.toISOString().slice(0, 10), sessions: s.sessions });
      seriesMap.set(key, arr);
    }
    const series = [...seriesMap.entries()].map(([aiSource, points]) => ({ aiSource, points }));

    return {
      brand: { id: brand.id, name: brand.name, domain: brand.domain },
      property: property
        ? {
            id: property.id,
            ga4PropertyId: property.ga4PropertyId,
            ga4PropertyName: property.ga4PropertyName,
            lastSyncAt: property.lastSyncAt,
            lastSyncStatus: property.lastSyncStatus,
            lastSyncError: property.lastSyncError,
          }
        : null,
      windowDays: days,
      totals,
      bySource,
      series,
    };
  });

  // ---------------------------------------------------------------
  // 8) POST /google/brands/:brandId/sync — sync manual desde la UI
  // ---------------------------------------------------------------
  fastify.post<{ Params: { brandId: string } }>(
    '/google/brands/:brandId/sync',
    async (request, reply) => {
      const u = await resolvePortalUserFromRequest(request);
      if (!u) return reply.code(401).send({ error: 'No autenticado.' });

      const brandId = request.params.brandId;
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, tenantId: true },
      });
      if (!brand) return reply.code(404).send({ error: 'brand_no_encontrada' });
      if (brand.tenantId !== u.tenantId) {
        return reply.code(403).send({ error: 'brand_no_pertenece_al_tenant' });
      }
      const property = await prisma.googleAnalyticsProperty.findUnique({ where: { brandId } });
      if (!property) return reply.code(404).send({ error: 'sin_propiedad_seleccionada' });

      try {
        const accessToken = await getAccessTokenForTenant(u.tenantId);
        const rows = await runAITrafficReport({
          accessToken,
          propertyId: property.ga4PropertyId,
        });
        await persistSnapshots({ propertyId: property.id, brandId, rows });
        await prisma.googleAnalyticsProperty.update({
          where: { id: property.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'ok',
            lastSyncError: null,
          },
        });
        return { ok: true, rowsFetched: rows.length };
      } catch (err: any) {
        await prisma.googleAnalyticsProperty.update({
          where: { id: property.id },
          data: {
            lastSyncStatus: 'error',
            lastSyncError: String(err?.message || err).slice(0, 1000),
          },
        });
        return reply.code(502).send({ error: 'sync_failed', message: String(err?.message || err) });
      }
    }
  );

  // ---------------------------------------------------------------
  // 9) POST /google/cron/sync-all — para Railway scheduler
  // Llamar con header `x-cron-secret: $CRON_SECRET`
  // ---------------------------------------------------------------
  fastify.post('/google/cron/sync-all', async (request, reply) => {
    const expected = (process.env.CRON_SECRET || '').trim();
    const got = String(request.headers['x-cron-secret'] || '').trim();
    if (!expected || got !== expected) {
      return reply.code(401).send({ error: 'cron_secret_invalido' });
    }
    if (!isGoogleOAuthConfigured() || !isGoogleTokenCryptoConfigured()) {
      return reply.code(503).send({ error: 'google_no_configurado' });
    }

    const properties = await prisma.googleAnalyticsProperty.findMany({
      include: { integration: true },
    });

    const results: Array<{ propertyId: string; brandId: string; ok: boolean; rows?: number; error?: string }> = [];

    for (const prop of properties) {
      if (prop.integration.status !== 'active') {
        results.push({ propertyId: prop.id, brandId: prop.brandId, ok: false, error: `integration_${prop.integration.status}` });
        continue;
      }
      try {
        const accessToken = await getAccessTokenForTenant(prop.integration.tenantId);
        const rows = await runAITrafficReport({
          accessToken,
          propertyId: prop.ga4PropertyId,
          startDate: '7daysAgo', // cron solo refresca últimos 7 días para minimizar costo
          endDate: 'yesterday',
        });
        await persistSnapshots({ propertyId: prop.id, brandId: prop.brandId, rows });
        await prisma.googleAnalyticsProperty.update({
          where: { id: prop.id },
          data: { lastSyncAt: new Date(), lastSyncStatus: 'ok', lastSyncError: null },
        });
        results.push({ propertyId: prop.id, brandId: prop.brandId, ok: true, rows: rows.length });
      } catch (err: any) {
        await prisma.googleAnalyticsProperty.update({
          where: { id: prop.id },
          data: { lastSyncStatus: 'error', lastSyncError: String(err?.message || err).slice(0, 1000) },
        });
        results.push({ propertyId: prop.id, brandId: prop.brandId, ok: false, error: String(err?.message || err) });
      }
    }

    return { ok: true, total: results.length, results };
  });
};

export default googleIntegrationRoutes;
