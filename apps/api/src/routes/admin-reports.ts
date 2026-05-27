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
};

export default adminReportsRoutes;
