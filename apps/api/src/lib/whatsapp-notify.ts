import type { FastifyBaseLogger } from 'fastify';
import { prisma } from './prisma';
import { getAppBaseUrlForPublicLinks } from './app-public-url';
import { isBuilderBotSendConfigured, sendWhatsAppMessage } from './builderbot';
import {
  buildWaResultUrl,
  buildWhatsAppCompletedReply,
  buildWhatsAppTeaserLine,
  isWhatsAppSourceChannel,
} from './whatsapp-channel';

/** Al terminar el pipeline WA: Cleexs arma el texto y BuilderBot lo envía al cliente. */
export async function notifyWhatsAppDiagnosticCompleted(
  log: FastifyBaseLogger,
  diagnosticId: string
): Promise<void> {
  if (!isBuilderBotSendConfigured()) {
    log.warn({ diagnosticId }, 'Canal WA: BUILDERBOT_* no configurado; no se envía score por WhatsApp');
    return;
  }

  const row = await prisma.publicDiagnostic.findUnique({
    where: { id: diagnosticId },
    select: {
      id: true,
      domain: true,
      brandName: true,
      status: true,
      sourceChannel: true,
      waPhone: true,
      setupDraftJson: true,
      runId: true,
      analysisJson: true,
    },
  });

  if (!row || !isWhatsAppSourceChannel(row.sourceChannel) || !row.waPhone) return;
  if (row.status !== 'completed' || !row.runId) return;

  const run = await prisma.run.findUnique({
    where: { id: row.runId },
    include: { priaReports: { take: 1, orderBy: { createdAt: 'desc' } } },
  });
  const cleexsScore = run?.priaReports[0]?.priaTotal;
  if (cleexsScore == null) return;

  const resultUrl = buildWaResultUrl(row.id, getAppBaseUrlForPublicLinks());
  const message = buildWhatsAppCompletedReply({
    domain: row.domain,
    brandName: row.brandName,
    cleexsScore,
    teaserLine: buildWhatsAppTeaserLine(cleexsScore, row.analysisJson),
    resultUrl,
  });

  const draft =
    row.setupDraftJson && typeof row.setupDraftJson === 'object' && !Array.isArray(row.setupDraftJson)
      ? (row.setupDraftJson as { waRecipient?: string })
      : null;
  const recipient = draft?.waRecipient?.trim() || row.waPhone;

  try {
    await sendWhatsAppMessage({ number: recipient, message, checkIfExists: true });
    log.info({ diagnosticId, recipient }, 'Canal WA: score enviado por BuilderBot API');
  } catch (err) {
    log.error({ err, diagnosticId }, 'Canal WA: error al enviar score por BuilderBot');
  }
}
