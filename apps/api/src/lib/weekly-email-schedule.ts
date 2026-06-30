export type WeeklyEmailScheduleConfig = {
  enabled: boolean;
  dayOfWeekUtc: number;
  hourUtc: number;
};

/** Inicio de la ventana semanal actual: el martes (o día configurado) a la hora UTC indicada más reciente que ya pasó. */
export function getCurrentWeeklyWindowStart(
  schedule: Pick<WeeklyEmailScheduleConfig, 'dayOfWeekUtc' | 'hourUtc'>,
  now = new Date()
): Date | null {
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), schedule.hourUtc, 0, 0, 0)
  );
  const daysSinceSchedule = (now.getUTCDay() - schedule.dayOfWeekUtc + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() - daysSinceSchedule);
  if (now < candidate) return null;
  return candidate;
}

export function weeklyCampaignSlugForWindow(windowStart: Date, weekSlot: number): string {
  const y = windowStart.getUTCFullYear();
  const m = String(windowStart.getUTCMonth() + 1).padStart(2, '0');
  const d = String(windowStart.getUTCDate()).padStart(2, '0');
  return `weekly-auto-w${weekSlot}-${y}-${m}-${d}`;
}

export function evaluateWeeklyEmailSend(
  schedule: WeeklyEmailScheduleConfig,
  options: { force?: boolean; now?: Date }
): { due: boolean; reason?: string; windowStart?: Date } {
  const now = options.now ?? new Date();
  if (options.force) {
    const windowStart = getCurrentWeeklyWindowStart(schedule, now) ?? now;
    return { due: true, windowStart };
  }
  if (!schedule.enabled) {
    return { due: false, reason: 'schedule_disabled' };
  }
  const windowStart = getCurrentWeeklyWindowStart(schedule, now);
  if (!windowStart) {
    return { due: false, reason: 'before_window' };
  }
  return { due: true, windowStart };
}
