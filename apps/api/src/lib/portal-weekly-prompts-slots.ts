/**
 * Slots durables de prompts del portal (Agency + portal crecimiento).
 * Agency EasyPanel espera 40 (0..39). Históricamente era 5 (0..4).
 * No hay CHECK histórico en BD: el tope vive en validación de API + comentario de schema.
 */
export const PORTAL_WEEKLY_PROMPT_SLOT_COUNT = 40;
export const PORTAL_WEEKLY_PROMPT_MAX_SLOT = PORTAL_WEEKLY_PROMPT_SLOT_COUNT - 1;

export function isValidPortalWeeklyPromptSlot(slot: unknown): slot is number {
  return Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) <= PORTAL_WEEKLY_PROMPT_MAX_SLOT;
}

export function portalWeeklyPromptSlotRangeError(): string {
  return `slot debe ser un entero entre 0 y ${PORTAL_WEEKLY_PROMPT_MAX_SLOT}.`;
}
