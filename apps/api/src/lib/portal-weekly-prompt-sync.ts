import { prisma } from './prisma';
import { resolveActivePromptVersion } from './run-executor';

/** Crea/actualiza el registro `Prompt` inactivo ligado al prompt guardado del portal (para PromptResult + executeRun). */
export async function syncShadowPromptForSaved(
  tenantId: string,
  saved: { id: string; slot: number; title: string; promptText: string }
): Promise<void> {
  const pv = await resolveActivePromptVersion(tenantId, null);
  if (!pv) throw new Error('No hay versión de prompts activa');

  const text = saved.promptText.trim();
  if (!text) throw new Error('El texto del prompt no puede estar vacío');

  const name = `[Portal semanal] ${saved.title.trim() || `Opción ${saved.slot + 1}`}`;

  await prisma.prompt.upsert({
    where: { brandPortalSavedPromptId: saved.id },
    create: {
      promptVersionId: pv.id,
      name,
      promptText: text,
      active: false,
      brandPortalSavedPromptId: saved.id,
    },
    update: {
      name,
      promptText: text,
      promptVersionId: pv.id,
    },
  });
}
