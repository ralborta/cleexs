import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const windowDaysSchema = z.object({
  windowDays: z
    .string()
    .optional()
    .transform((value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return 30;
      if (n <= 7) return 7;
      if (n <= 30) return 30;
      return 90;
    }),
});

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function buildDailySeries<T extends { createdAt: Date }>(
  rows: T[],
  fromDate: Date,
  windowDays: number,
  enrich?: (acc: Record<string, number>, row: T, key: string) => void
): Array<{ date: string; count: number; extra?: Record<string, number> }> {
  const series: Array<{ date: string; count: number; extra?: Record<string, number> }> = [];
  for (let i = 0; i < windowDays; i += 1) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    series.push({ date: dayKey(d), count: 0, extra: enrich ? {} : undefined });
  }
  const lookup = new Map(series.map((row, idx) => [row.date, idx] as const));
  for (const row of rows) {
    const key = dayKey(row.createdAt);
    const idx = lookup.get(key);
    if (idx == null) continue;
    series[idx].count += 1;
    if (enrich && series[idx].extra) enrich(series[idx].extra as Record<string, number>, row, key);
  }
  return series;
}

function envFlag(name: string): boolean {
  return Boolean(process.env[name]?.toString().trim());
}

function envValue(name: string, fallback = ''): string {
  return process.env[name]?.toString().trim() || fallback;
}

function envBool(name: string): boolean {
  return process.env[name]?.toString().trim().toLowerCase() === 'true';
}

const adminReportsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1) Reporte de Adquisicion y Funnel
  // ----------------------------------------------------------------
  fastify.get('/internal/acquisition', async (request) => {
    const parsed = windowDaysSchema.safeParse(request.query);
    const windowDays = parsed.success ? parsed.data.windowDays : 30;
    const fromDate = startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - (windowDays - 1));

    const [diagnosticsInWindow, totalDiagnosticsAllTime] = await Promise.all([
      prisma.publicDiagnostic.findMany({
        where: { createdAt: { gte: fromDate } },
        select: {
          id: true,
          createdAt: true,
          status: true,
          email: true,
          refCode: true,
          utmSource: true,
          utmMedium: true,
          sourceChannel: true,
          domain: true,
          brandName: true,
          tier: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.publicDiagnostic.count(),
    ]);

    const totalCreated = diagnosticsInWindow.length;
    const totalWithEmail = diagnosticsInWindow.filter((d) => Boolean(d.email)).length;
    const totalCompleted = diagnosticsInWindow.filter((d) => d.status === 'completed').length;
    const totalGold = diagnosticsInWindow.filter((d) => d.tier === 'gold').length;

    const series = buildDailySeries(diagnosticsInWindow, fromDate, windowDays, (extra, row) => {
      extra.completed = (extra.completed || 0) + (row.status === 'completed' ? 1 : 0);
      extra.withEmail = (extra.withEmail || 0) + (row.email ? 1 : 0);
    }).map((row) => ({
      date: row.date,
      created: row.count,
      completed: row.extra?.completed ?? 0,
      withEmail: row.extra?.withEmail ?? 0,
    }));

    const channelMap = new Map<string, number>();
    for (const row of diagnosticsInWindow) {
      const channel = (row.sourceChannel || 'web').trim().toLowerCase() || 'web';
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    }
    const channels = Array.from(channelMap.entries())
      .map(([channel, count]) => ({ channel, count, share: totalCreated ? (count / totalCreated) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);

    type RefRow = {
      refCode: string;
      visits: number;
      completed: number;
      capturedEmails: number;
      latestAt: Date;
    };
    const refMap = new Map<string, RefRow>();
    for (const row of diagnosticsInWindow) {
      const code = (row.refCode || '').trim().toLowerCase();
      if (!code) continue;
      const current = refMap.get(code) || {
        refCode: code,
        visits: 0,
        completed: 0,
        capturedEmails: 0,
        latestAt: row.createdAt,
      };
      current.visits += 1;
      if (row.status === 'completed') current.completed += 1;
      if (row.email) current.capturedEmails += 1;
      if (row.createdAt > current.latestAt) current.latestAt = row.createdAt;
      refMap.set(code, current);
    }
    const topReferrers = Array.from(refMap.values())
      .map((row) => ({
        refCode: row.refCode,
        visits: row.visits,
        completed: row.completed,
        capturedEmails: row.capturedEmails,
        completionRate: row.visits > 0 ? (row.completed / row.visits) * 100 : 0,
        latestAt: row.latestAt.toISOString(),
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 15);

    const utmMap = new Map<string, number>();
    for (const row of diagnosticsInWindow) {
      const src = (row.utmSource || '').trim() || 'directo';
      utmMap.set(src, (utmMap.get(src) || 0) + 1);
    }
    const topUtmSources = Array.from(utmMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const latest = diagnosticsInWindow.slice(0, 25).map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      brandName: row.brandName,
      domain: row.domain,
      email: row.email,
      status: row.status,
      tier: row.tier,
      refCode: row.refCode,
      utmSource: row.utmSource,
      sourceChannel: row.sourceChannel,
    }));

    return {
      windowDays,
      asOf: new Date().toISOString(),
      totals: {
        diagnosticsInWindow: totalCreated,
        diagnosticsAllTime: totalDiagnosticsAllTime,
        completedInWindow: totalCompleted,
        withEmailInWindow: totalWithEmail,
        goldInWindow: totalGold,
        completionRate: totalCreated ? (totalCompleted / totalCreated) * 100 : 0,
        emailCaptureRate: totalCreated ? (totalWithEmail / totalCreated) * 100 : 0,
        goldUpgradeRate: totalCreated ? (totalGold / totalCreated) * 100 : 0,
      },
      dailySeries: series,
      channels,
      topReferrers,
      topUtmSources,
      latestDiagnostics: latest,
    };
  });

  // 2) Reporte de Cleexs Score y posicionamiento
  // ----------------------------------------------------------------
  fastify.get('/internal/cleexs-score', async (request) => {
    const parsed = windowDaysSchema.safeParse(request.query);
    const windowDays = parsed.success ? parsed.data.windowDays : 30;
    const fromDate = startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - (windowDays - 1));

    const reports = await prisma.pRIAReport.findMany({
      where: { createdAt: { gte: fromDate } },
      include: {
        brand: {
          select: { id: true, name: true, domain: true, industry: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReports = reports.length;
    const sum = reports.reduce((acc, r) => acc + (r.priaTotal || 0), 0);
    const avgScore = totalReports > 0 ? sum / totalReports : 0;

    const buckets = {
      poor: 0,
      low: 0,
      mid: 0,
      good: 0,
      excellent: 0,
    };
    for (const r of reports) {
      const s = r.priaTotal;
      if (s < 20) buckets.poor += 1;
      else if (s < 40) buckets.low += 1;
      else if (s < 60) buckets.mid += 1;
      else if (s < 80) buckets.good += 1;
      else buckets.excellent += 1;
    }

    type BrandStat = {
      brandId: string;
      brandName: string;
      domain: string | null;
      industry: string | null;
      latestScore: number;
      latestAt: Date;
      avgScore: number;
      runs: number;
    };
    const brandMap = new Map<string, BrandStat>();
    for (const r of reports) {
      const key = r.brandId;
      const current = brandMap.get(key);
      if (!current) {
        brandMap.set(key, {
          brandId: r.brandId,
          brandName: r.brand.name,
          domain: r.brand.domain,
          industry: r.brand.industry,
          latestScore: r.priaTotal,
          latestAt: r.createdAt,
          avgScore: r.priaTotal,
          runs: 1,
        });
        continue;
      }
      current.runs += 1;
      current.avgScore = (current.avgScore * (current.runs - 1) + r.priaTotal) / current.runs;
      if (r.createdAt > current.latestAt) {
        current.latestAt = r.createdAt;
        current.latestScore = r.priaTotal;
      }
    }
    const brandStats = Array.from(brandMap.values()).map((b) => ({
      brandId: b.brandId,
      brandName: b.brandName,
      domain: b.domain,
      industry: b.industry,
      latestScore: Math.round(b.latestScore * 10) / 10,
      avgScore: Math.round(b.avgScore * 10) / 10,
      latestAt: b.latestAt.toISOString(),
      runs: b.runs,
    }));

    const topBrands = [...brandStats].sort((a, b) => b.latestScore - a.latestScore).slice(0, 10);
    const bottomBrands = [...brandStats]
      .sort((a, b) => a.latestScore - b.latestScore)
      .slice(0, 10);

    type IndustryStat = { industry: string; runs: number; sum: number };
    const industryMap = new Map<string, IndustryStat>();
    for (const r of reports) {
      const industry = (r.brand.industry || 'Sin industria').trim() || 'Sin industria';
      const current = industryMap.get(industry) || { industry, runs: 0, sum: 0 };
      current.runs += 1;
      current.sum += r.priaTotal;
      industryMap.set(industry, current);
    }
    const industries = Array.from(industryMap.values())
      .map((row) => ({
        industry: row.industry,
        runs: row.runs,
        avgScore: row.runs ? Math.round((row.sum / row.runs) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 12);

    const series = buildDailySeries(reports, fromDate, windowDays, (extra, row) => {
      extra.scoreSum = (extra.scoreSum || 0) + (row.priaTotal || 0);
    }).map((row) => ({
      date: row.date,
      runs: row.count,
      avgScore:
        row.count > 0 && row.extra
          ? Math.round(((row.extra.scoreSum || 0) / row.count) * 10) / 10
          : 0,
    }));

    return {
      windowDays,
      asOf: new Date().toISOString(),
      totals: {
        reportsInWindow: totalReports,
        brandsAnalyzed: brandMap.size,
        averageScore: Math.round(avgScore * 10) / 10,
      },
      distribution: buckets,
      topBrands,
      bottomBrands,
      industries,
      dailySeries: series,
    };
  });

  // 2.5) Marcas analizadas (vista completa por marca con owner y plan)
  // ----------------------------------------------------------------
  fastify.get('/internal/brands', async (request) => {
    const querySchema = z.object({
      search: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n <= 0) return 200;
          return Math.min(n, 500);
        }),
    });
    const parsed = querySchema.safeParse(request.query);
    const limit = parsed.success ? parsed.data.limit : 200;
    const search = parsed.success ? parsed.data.search?.trim().toLowerCase() : undefined;

    const brands = await prisma.brand.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true,
        country: true,
        category: true,
        runSchedule: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            tenantCode: true,
            tenantType: true,
            status: true,
            plan: { select: { name: true } },
          },
        },
        runs: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            priaReports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { priaTotal: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { runs: true } },
      },
    });

    const items = brands.map((brand) => {
      const lastRun = brand.runs[0];
      let lastScore: number | null = null;
      let lastScoreAt: string | null = null;
      for (const run of brand.runs) {
        if (run.priaReports[0]) {
          lastScore = run.priaReports[0].priaTotal;
          lastScoreAt = run.priaReports[0].createdAt.toISOString();
          break;
        }
      }
      return {
        id: brand.id,
        name: brand.name,
        domain: brand.domain,
        industry: brand.industry,
        country: brand.country,
        category: brand.category,
        runSchedule: brand.runSchedule,
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
        runsTotal: brand._count.runs,
        lastRun: lastRun
          ? {
              id: lastRun.id,
              status: lastRun.status,
              createdAt: lastRun.createdAt.toISOString(),
            }
          : null,
        lastScore,
        lastScoreAt,
        tenant: brand.tenant
          ? {
              id: brand.tenant.id,
              code: brand.tenant.tenantCode,
              type: brand.tenant.tenantType,
              status: brand.tenant.status,
              plan: brand.tenant.plan?.name ?? null,
            }
          : null,
      };
    });

    const filtered = search
      ? items.filter((b) => {
          const hay = `${b.name} ${b.domain || ''} ${b.industry || ''} ${b.tenant?.code || ''} ${b.tenant?.plan || ''}`.toLowerCase();
          return hay.includes(search);
        })
      : items;

    const summary = {
      total: filtered.length,
      withScore: filtered.filter((b) => b.lastScore != null).length,
      scoredAvg:
        filtered.filter((b) => b.lastScore != null).reduce((acc, b) => acc + (b.lastScore || 0), 0) /
          Math.max(1, filtered.filter((b) => b.lastScore != null).length),
      premium: filtered.filter((b) => (b.tenant?.plan || '').toLowerCase().includes('premium')).length,
      withRuns: filtered.filter((b) => b.runsTotal > 0).length,
    };

    return {
      asOf: new Date().toISOString(),
      summary: {
        ...summary,
        scoredAvg: Math.round(summary.scoredAvg * 10) / 10,
      },
      items: filtered,
    };
  });

  // 3) Reporte de Email y Outreach
  // ----------------------------------------------------------------
  fastify.get('/internal/email-outreach', async (request) => {
    const parsed = windowDaysSchema.safeParse(request.query);
    const windowDays = parsed.success ? parsed.data.windowDays : 30;
    const fromDate = startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - (windowDays - 1));

    const [
      weeklyLogs,
      weeklyEventsByType,
      outreachEmails,
      outreachContacts,
      campaigns,
    ] = await Promise.all([
      prisma.cleexsInternalEmailSendLog.findMany({
        where: { createdAt: { gte: fromDate } },
        select: {
          id: true,
          status: true,
          campaignSlug: true,
          recipientEmail: true,
          createdAt: true,
          scoreBucket: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cleexsResendWebhookEvent.groupBy({
        by: ['eventType'],
        where: { occurredAt: { gte: fromDate } },
        _count: { _all: true },
      }),
      prisma.leadEmail.findMany({
        where: { createdAt: { gte: fromDate } },
        select: {
          id: true,
          status: true,
          sentAt: true,
          createdAt: true,
          metaJson: true,
          leadContact: { select: { email: true } },
          leadSource: { select: { competitorName: true, competitorDomain: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leadContact.count(),
      prisma.cleexsInternalEmailCampaign.count(),
    ]);

    const weeklyTotals = {
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    };
    for (const log of weeklyLogs) {
      const key = log.status as keyof typeof weeklyTotals;
      if (key in weeklyTotals) weeklyTotals[key] += 1;
    }

    const weeklyEvents: Record<string, number> = {};
    for (const g of weeklyEventsByType) {
      weeklyEvents[g.eventType] = g._count._all;
    }

    type OutreachMeta = {
      eventCounts?: Record<string, number>;
      lastEvent?: string;
      mode?: string;
    } | null;
    const outreachTotals = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      delivery_delayed: 0,
      shadow: 0,
      real: 0,
      drafts: 0,
    };
    type DomainStat = {
      domain: string;
      sent: number;
      opened: number;
      clicked: number;
    };
    const domainMap = new Map<string, DomainStat>();

    for (const email of outreachEmails) {
      const meta = (email.metaJson as OutreachMeta) ?? {};
      const counts = (meta?.eventCounts || {}) as Record<string, number>;
      if (email.status === 'draft' || email.status === 'queued') {
        outreachTotals.drafts += 1;
      }
      if (email.status === 'sent' || email.sentAt) {
        outreachTotals.sent += 1;
      }
      const lastEvent = (meta?.lastEvent || '').toLowerCase();
      if (lastEvent === 'failed') outreachTotals.failed += 1;
      for (const [evt, c] of Object.entries(counts)) {
        const key = evt.replace('email.', '');
        if (key in outreachTotals) {
          outreachTotals[key as keyof typeof outreachTotals] += c;
        }
      }
      if (meta?.mode === 'shadow') outreachTotals.shadow += 1;
      if (meta?.mode === 'real') outreachTotals.real += 1;

      const domain = (email.leadSource?.competitorDomain || '').trim().toLowerCase();
      if (domain) {
        const current = domainMap.get(domain) || { domain, sent: 0, opened: 0, clicked: 0 };
        if (email.sentAt || email.status === 'sent') current.sent += 1;
        const ev = (meta?.eventCounts || {}) as Record<string, number>;
        current.opened += ev['email.opened'] || ev.opened || 0;
        current.clicked += ev['email.clicked'] || ev.clicked || 0;
        domainMap.set(domain, current);
      }
    }

    const topOutreachDomains = Array.from(domainMap.values())
      .sort((a, b) => {
        const aRate = a.sent > 0 ? a.opened / a.sent : 0;
        const bRate = b.sent > 0 ? b.opened / b.sent : 0;
        return bRate - aRate || b.sent - a.sent;
      })
      .slice(0, 12)
      .map((row) => ({
        domain: row.domain,
        sent: row.sent,
        opened: row.opened,
        clicked: row.clicked,
        openRate: row.sent > 0 ? (row.opened / row.sent) * 100 : 0,
        clickRate: row.sent > 0 ? (row.clicked / row.sent) * 100 : 0,
      }));

    const weeklySeries = buildDailySeries(weeklyLogs, fromDate, windowDays).map((row) => ({
      date: row.date,
      sends: row.count,
    }));
    const outreachSeries = buildDailySeries(outreachEmails, fromDate, windowDays).map((row) => ({
      date: row.date,
      sends: row.count,
    }));

    const outreachDeliveryRate =
      outreachTotals.sent > 0 ? (outreachTotals.delivered / outreachTotals.sent) * 100 : 0;
    const outreachOpenRate =
      outreachTotals.delivered > 0
        ? (outreachTotals.opened / outreachTotals.delivered) * 100
        : 0;
    const outreachBounceRate =
      outreachTotals.sent > 0 ? (outreachTotals.bounced / outreachTotals.sent) * 100 : 0;

    return {
      windowDays,
      asOf: new Date().toISOString(),
      weekly: {
        campaignsConfigured: campaigns,
        totals: weeklyTotals,
        eventsByType: weeklyEvents,
        dailySeries: weeklySeries,
      },
      outreach: {
        contactsAllTime: outreachContacts,
        totals: outreachTotals,
        rates: {
          deliveryRate: Math.round(outreachDeliveryRate * 10) / 10,
          openRate: Math.round(outreachOpenRate * 10) / 10,
          bounceRate: Math.round(outreachBounceRate * 10) / 10,
        },
        topDomains: topOutreachDomains,
        dailySeries: outreachSeries,
      },
      integrations: {
        resendWebhookSecretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
        outreachDomainVerified: process.env.OUTREACH_DOMAIN_VERIFIED === 'true',
      },
    };
  });

  // 4) Configuracion del sistema (integraciones + variables + webhooks + cron + DB)
  // ----------------------------------------------------------------
  fastify.get('/internal/system-config', async () => {
    const now = new Date();
    const since30 = new Date(now);
    since30.setDate(since30.getDate() - 30);
    const since7 = new Date(now);
    since7.setDate(since7.getDate() - 7);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const apiBase =
      envValue('PUBLIC_WEBHOOK_BASE_URL') ||
      envValue('RAILWAY_PUBLIC_DOMAIN') ||
      envValue('API_URL') ||
      'https://cleexsapi-production.up.railway.app';
    const apiBaseHttp = apiBase.startsWith('http') ? apiBase : `https://${apiBase}`;

    const [
      mpEventsLast30,
      mpLastEvent,
      resendEventsLast30,
      resendLastEvent,
      resendEventsByType,
      weeklyLastSend,
      weeklySendsLast30,
      weeklySendsLast7,
      weeklyCampaignsActive,
      outreachTodayReal,
      outreachLast7,
      dbCounts,
    ] = await Promise.all([
      prisma.webhookEvent
        .count({ where: { receivedAt: { gte: since30 } } })
        .catch(() => 0),
      prisma.webhookEvent
        .findFirst({ orderBy: { receivedAt: 'desc' }, select: { receivedAt: true, provider: true } })
        .catch(() => null),
      prisma.cleexsResendWebhookEvent
        .count({ where: { occurredAt: { gte: since30 } } })
        .catch(() => 0),
      prisma.cleexsResendWebhookEvent
        .findFirst({ orderBy: { occurredAt: 'desc' }, select: { occurredAt: true, eventType: true } })
        .catch(() => null),
      prisma.cleexsResendWebhookEvent
        .groupBy({
          by: ['eventType'],
          where: { occurredAt: { gte: since30 } },
          _count: { _all: true },
        })
        .catch(() => [] as Array<{ eventType: string; _count: { _all: number } }>),
      prisma.cleexsInternalEmailSendLog
        .findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, status: true } })
        .catch(() => null),
      prisma.cleexsInternalEmailSendLog
        .count({ where: { createdAt: { gte: since30 } } })
        .catch(() => 0),
      prisma.cleexsInternalEmailSendLog
        .count({ where: { createdAt: { gte: since7 } } })
        .catch(() => 0),
      prisma.cleexsInternalEmailCampaign
        .count({ where: { active: true } })
        .catch(() => 0),
      prisma.leadEmail
        .count({
          where: {
            sentAt: { gte: startOfToday },
            metaJson: { path: ['mode'], equals: 'real' },
          },
        })
        .catch(() => 0),
      prisma.leadEmail.count({ where: { sentAt: { gte: since7 } } }).catch(() => 0),
      Promise.all([
        prisma.tenant.count(),
        prisma.user.count(),
        prisma.brand.count(),
        prisma.run.count(),
        prisma.payment.count(),
        prisma.subscription.count(),
        prisma.leadContact.count(),
        prisma.leadEmail.count(),
        prisma.publicDiagnostic.count(),
      ]).then(([tenants, users, brands, runs, payments, subscriptions, leadContacts, leadEmails, publicDiagnostics]) => ({
        tenants,
        users,
        brands,
        runs,
        payments,
        subscriptions,
        leadContacts,
        leadEmails,
        publicDiagnostics,
      })),
    ]);

    const resendEventsByTypeMap: Record<string, number> = {};
    for (const g of resendEventsByType) {
      resendEventsByTypeMap[g.eventType] = g._count._all;
    }

    return {
      asOf: now.toISOString(),
      environment: {
        nodeVersion: process.version,
        uptimeSec: Math.floor(process.uptime()),
        hostname: process.env.HOSTNAME || null,
        railwayCommit: envValue('RAILWAY_GIT_COMMIT_SHA') || null,
        railwayBranch: envValue('RAILWAY_GIT_BRANCH') || null,
        railwayDomain: envValue('RAILWAY_PUBLIC_DOMAIN') || null,
        nodeEnv: envValue('NODE_ENV', 'development'),
      },
      integrations: {
        openai: {
          configured: envFlag('OPENAI_API_KEY'),
          model: envValue('DIAGNOSTIC_AI_OPENAI_MODEL', 'gpt-4o-mini'),
          competitorsModel: envValue('DIAGNOSTIC_COMPETITORS_OPENAI_MODEL', 'gpt-4o'),
        },
        gemini: {
          configured:
            envFlag('GEMINI_API_KEY') || envFlag('GOOGLE_API_KEY') || envFlag('GOOGLE_AI_API_KEY'),
        },
        resend: {
          apiKeyConfigured: envFlag('RESEND_API_KEY'),
          webhookSecretConfigured: envFlag('RESEND_WEBHOOK_SECRET'),
        },
        smtp: {
          configured:
            envFlag('SMTP_HOST') &&
            envValue('SMTP_HOST') !== 'localhost' &&
            envFlag('SMTP_USER') &&
            envFlag('SMTP_PASS'),
          host: envValue('SMTP_HOST') || null,
          port: Number(envValue('SMTP_PORT', '587')),
          fromEmail: envValue('SMTP_FROM_EMAIL') || envValue('SMTP_FROM') || null,
          fromName: envValue('SMTP_FROM_NAME') || null,
        },
        mercadopago: {
          accessTokenConfigured: envFlag('MP_ACCESS_TOKEN'),
          webhookSecretConfigured: envFlag('MP_WEBHOOK_SECRET'),
          webhookUrl: `${apiBaseHttp.replace(/\/$/, '')}/api/webhooks/mercadopago`,
        },
        firecrawl: { configured: envFlag('FIRECRAWL_API_KEY') },
        hunter: { configured: envFlag('HUNTER_API_KEY') },
        serper: { configured: envFlag('SERPER_API_KEY') },
        builderbot: {
          configured: envFlag('BUILDERBOT_BOT_ID') && envFlag('BUILDERBOT_API_KEY'),
          baseUrl: envValue('BUILDERBOT_BASE_URL', 'https://app.builderbot.cloud'),
        },
        whatsapp: {
          apiKeyConfigured: envFlag('WHATSAPP_CHANNEL_API_KEY'),
          dailyLimit: Number(envValue('WA_CHANNEL_DAILY_LIMIT', '5')),
        },
        satellite: {
          enabled: envValue('SATELLITE_ENABLED', 'true').toLowerCase() !== 'false',
          baseUrl: envValue('SATELLITE_BASE_URL') || null,
        },
        database: {
          configured: envFlag('DATABASE_URL'),
        },
      },
      variables: {
        outreach: {
          fromEmail: envValue('OUTREACH_FROM_EMAIL') || null,
          fromName: envValue('OUTREACH_FROM_NAME') || null,
          replyTo: envValue('OUTREACH_REPLY_TO') || null,
          shadowTo: envValue('OUTREACH_SHADOW_TO') || null,
          dailyLimit: Number(envValue('OUTREACH_DAILY_LIMIT', '20')),
          domainVerified: envBool('OUTREACH_DOMAIN_VERIFIED'),
        },
        admin: {
          apiSecretConfigured: envFlag('ADMIN_API_SECRET'),
          requireAuth: envBool('ADMIN_REQUIRE_AUTH'),
          fullAccessEmails:
            envValue('ADMIN_FULL_ACCESS_EMAILS')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean).length,
          allowActorQuery: envBool('ALLOW_USAGE_ACTOR_QUERY'),
        },
        auth: {
          portalJwtSecretConfigured: envFlag('PORTAL_JWT_SECRET'),
          cronSecretConfigured: envFlag('CRON_SECRET'),
        },
        urls: {
          frontend: envValue('FRONTEND_URL') || null,
          frontendList: envValue('FRONTEND_URLS') || null,
          appUrl: envValue('CLEEXS_APP_URL') || envValue('NEXT_PUBLIC_APP_URL') || null,
          marketingUrl: envValue('CLEEXS_MARKETING_URL', 'https://cleexs.net'),
          apiBase: apiBaseHttp,
        },
        billing: {
          usdToArsRate: Number(envValue('BILLING_USD_TO_ARS_RATE', '0')) || null,
          currency: envValue('BILLING_CURRENCY') || null,
        },
        publicDiagnostic: {
          defaultCountry: envValue('PUBLIC_DIAGNOSTIC_DEFAULT_COUNTRY', 'Argentina'),
          marketConfidenceMin: Number(envValue('PUBLIC_DIAGNOSTIC_MARKET_CONFIDENCE_MIN', '70')),
        },
      },
      webhooks: {
        mercadopago: {
          url: `${apiBaseHttp.replace(/\/$/, '')}/api/webhooks/mercadopago`,
          eventsLast30Days: mpEventsLast30,
          lastEventAt: mpLastEvent?.receivedAt?.toISOString() ?? null,
          lastEventSource: mpLastEvent?.provider ?? null,
          configured: envFlag('MP_ACCESS_TOKEN'),
        },
        resend: {
          url: `${apiBaseHttp.replace(/\/$/, '')}/api/webhooks/resend`,
          eventsLast30Days: resendEventsLast30,
          lastEventAt: resendLastEvent?.occurredAt?.toISOString() ?? null,
          lastEventType: resendLastEvent?.eventType ?? null,
          eventsByType: resendEventsByTypeMap,
          configured: envFlag('RESEND_WEBHOOK_SECRET'),
        },
      },
      cron: {
        weeklyEmails: {
          lastSendAt: weeklyLastSend?.createdAt?.toISOString() ?? null,
          lastSendStatus: weeklyLastSend?.status ?? null,
          sendsLast30Days: weeklySendsLast30,
          sendsLast7Days: weeklySendsLast7,
          campaignsActive: weeklyCampaignsActive,
          cronSecretConfigured: envFlag('CRON_SECRET'),
        },
        outreach: {
          dailyLimit: Number(envValue('OUTREACH_DAILY_LIMIT', '20')),
          todayRealSent: outreachTodayReal,
          last7DaysSent: outreachLast7,
          domainVerified: envBool('OUTREACH_DOMAIN_VERIFIED'),
        },
      },
      database: dbCounts,
    };
  });

  // 6) Listado de Facturas / Pagos emitidos a clientes
  // ----------------------------------------------------------------
  fastify.get('/internal/payments', async (request) => {
    const querySchema = z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      page: z.string().optional(),
      pageSize: z.string().optional(),
    });
    const parsed = querySchema.safeParse(request.query);
    const status = parsed.success ? parsed.data.status?.trim() : undefined;
    const search = parsed.success ? parsed.data.search?.trim() : undefined;
    const page = Math.max(1, Number(parsed.success ? parsed.data.page : '1') || 1);
    const pageSizeRaw = Number(parsed.success ? parsed.data.pageSize : '20') || 20;
    const pageSize = Math.min(100, Math.max(5, pageSizeRaw));

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { payerEmail: { contains: search, mode: 'insensitive' } },
        { mpPaymentId: { contains: search, mode: 'insensitive' } },
        { mpMerchantOrderId: { contains: search, mode: 'insensitive' } },
        { tenant: { is: { tenantCode: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [items, total, byStatusRaw, allTime, approvedThisMonth] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          currency: true,
          amountArs: true,
          amountUsd: true,
          netReceivedAmountArs: true,
          mpPaymentId: true,
          mpMerchantOrderId: true,
          mpPreapprovalId: true,
          paymentMethodId: true,
          paymentTypeId: true,
          statusDetail: true,
          payerEmail: true,
          paidAt: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              tenantCode: true,
              plan: { select: { id: true, name: true } },
            },
          },
          subscription: {
            select: {
              id: true,
              billingInterval: true,
              status: true,
              plan: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'approved' },
        _sum: { amountArs: true, amountUsd: true, netReceivedAmountArs: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'approved', paidAt: { gte: startOfMonth } },
        _sum: { amountArs: true, amountUsd: true, netReceivedAmountArs: true },
        _count: { _all: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[String(row.status)] = row._count?._all ?? 0;
    }

    return {
      items: items.map((p) => ({
        id: p.id,
        status: p.status,
        currency: p.currency,
        amountArs: p.amountArs ? Number(p.amountArs) : null,
        amountUsd: p.amountUsd ? Number(p.amountUsd) : null,
        netReceivedAmountArs: p.netReceivedAmountArs ? Number(p.netReceivedAmountArs) : null,
        mpPaymentId: p.mpPaymentId,
        mpMerchantOrderId: p.mpMerchantOrderId,
        mpPreapprovalId: p.mpPreapprovalId,
        paymentMethodId: p.paymentMethodId,
        paymentTypeId: p.paymentTypeId,
        statusDetail: p.statusDetail,
        payerEmail: p.payerEmail,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        tenant: p.tenant
          ? {
              id: p.tenant.id,
              tenantCode: p.tenant.tenantCode,
              planName: p.tenant.plan?.name ?? null,
            }
          : null,
        subscription: p.subscription
          ? {
              id: p.subscription.id,
              billingInterval: p.subscription.billingInterval,
              status: p.subscription.status,
              planName: p.subscription.plan?.name ?? null,
            }
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byStatus,
        approvedAllTime: {
          count: allTime._count?._all ?? 0,
          totalArs: allTime._sum?.amountArs ? Number(allTime._sum.amountArs) : 0,
          totalUsd: allTime._sum?.amountUsd ? Number(allTime._sum.amountUsd) : 0,
          netReceivedArs: allTime._sum?.netReceivedAmountArs
            ? Number(allTime._sum.netReceivedAmountArs)
            : 0,
        },
        approvedThisMonth: {
          count: approvedThisMonth._count?._all ?? 0,
          totalArs: approvedThisMonth._sum?.amountArs
            ? Number(approvedThisMonth._sum.amountArs)
            : 0,
          totalUsd: approvedThisMonth._sum?.amountUsd
            ? Number(approvedThisMonth._sum.amountUsd)
            : 0,
          netReceivedArs: approvedThisMonth._sum?.netReceivedAmountArs
            ? Number(approvedThisMonth._sum.netReceivedAmountArs)
            : 0,
        },
      },
    };
  });

  // 7) Planes (lectura y edicion desde /admin/planes)
  // ----------------------------------------------------------------
  fastify.get('/internal/plans', async () => {
    const plans = await prisma.plan.findMany({
      orderBy: [{ displayOrder: 'asc' }, { priceMonthly: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { tenants: true, subscriptions: true } },
      },
    });

    return {
      items: plans.map((p) => ({
        id: p.id,
        name: p.name,
        tier: p.tier ?? null,
        description: p.description ?? null,
        ctaLabel: p.ctaLabel ?? null,
        badge: p.badge ?? null,
        isRecommended: p.isRecommended,
        isPublic: p.isPublic,
        displayOrder: p.displayOrder,
        priceMonthly: p.priceMonthly == null ? null : Number(p.priceMonthly),
        runsPerMonth: p.runsPerMonth,
        promptsActiveLimit: p.promptsActiveLimit,
        brandsLimit: p.brandsLimit,
        competitorsLimit: p.competitorsLimit,
        retentionMonths: p.retentionMonths,
        automationEnabled: p.automationEnabled,
        features: Array.isArray(p.features) ? (p.features as unknown as string[]) : [],
        engines: Array.isArray(p.engines) ? (p.engines as unknown as string[]) : [],
        tenantsCount: p._count.tenants,
        subscriptionsCount: p._count.subscriptions,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  });

  fastify.patch<{ Params: { id: string } }>('/internal/plans/:id', async (request, reply) => {
    const bodySchema = z
      .object({
        name: z.string().min(1).max(120).optional(),
        tier: z
          .string()
          .max(30)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        description: z
          .string()
          .max(2000)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        ctaLabel: z
          .string()
          .max(60)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        badge: z
          .string()
          .max(40)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        isRecommended: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        displayOrder: z.number().int().min(0).max(999).optional(),
        priceMonthly: z.number().min(0).max(1_000_000).nullable().optional(),
        runsPerMonth: z.number().int().min(0).max(1_000_000).optional(),
        promptsActiveLimit: z.number().int().min(0).max(1_000_000).optional(),
        brandsLimit: z.number().int().min(0).max(1_000_000).optional(),
        competitorsLimit: z.number().int().min(0).max(1_000_000).optional(),
        retentionMonths: z.number().int().min(0).max(120).optional(),
        automationEnabled: z.boolean().optional(),
        features: z.array(z.string().min(1).max(200)).max(20).optional(),
        engines: z.array(z.string().min(1).max(40)).max(10).optional(),
      })
      .strict();

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const { id } = request.params;
    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'plan_not_found' });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.features !== undefined) data.features = parsed.data.features;
    if (parsed.data.engines !== undefined) data.engines = parsed.data.engines;

    const updated = await prisma.plan.update({ where: { id }, data });
    return {
      id: updated.id,
      name: updated.name,
      tier: updated.tier ?? null,
      description: updated.description ?? null,
      ctaLabel: updated.ctaLabel ?? null,
      badge: updated.badge ?? null,
      isRecommended: updated.isRecommended,
      isPublic: updated.isPublic,
      displayOrder: updated.displayOrder,
      priceMonthly: updated.priceMonthly == null ? null : Number(updated.priceMonthly),
      runsPerMonth: updated.runsPerMonth,
      promptsActiveLimit: updated.promptsActiveLimit,
      brandsLimit: updated.brandsLimit,
      competitorsLimit: updated.competitorsLimit,
      retentionMonths: updated.retentionMonths,
      automationEnabled: updated.automationEnabled,
      features: Array.isArray(updated.features) ? (updated.features as unknown as string[]) : [],
      engines: Array.isArray(updated.engines) ? (updated.engines as unknown as string[]) : [],
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
};

export default adminReportsRoutes;
