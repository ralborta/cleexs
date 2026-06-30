import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export async function persistSavedPromptExecutionSnapshot(input: {
  savedPromptId: string;
  runId?: string | null;
  source: string;
  promptTextSnapshot: string;
  responseText: string;
  analysisJson?: Prisma.InputJsonValue | null;
}) {
  return prisma.brandPortalSavedPromptExecution.create({
    data: {
      savedPromptId: input.savedPromptId,
      runId: input.runId ?? null,
      source: input.source,
      promptTextSnapshot: input.promptTextSnapshot,
      responseText: input.responseText,
      analysisJson: input.analysisJson === null ? Prisma.JsonNull : input.analysisJson,
    },
  });
}
