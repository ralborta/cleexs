/** Argentina (Buenos Aires) no usa DST desde 2009: siempre UTC−3. */

export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatDayInArgentina(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ARGENTINA_TIME_ZONE }).format(date);
}

export function isValidDayString(day: string): boolean {
  return DAY_RE.test(day);
}

/** 00:00:00.000 del calendario en Argentina, como instante UTC. */
export function argentinaDayStartUtc(day: string): Date {
  if (!isValidDayString(day)) throw new Error(`invalid day: ${day}`);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
}

/** 23:59:59.999 del calendario en Argentina, como instante UTC. */
export function argentinaDayEndUtc(day: string): Date {
  if (!isValidDayString(day)) throw new Error(`invalid day: ${day}`);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999));
}

export function addDaysToDayString(day: string, delta: number): string {
  const start = argentinaDayStartUtc(day);
  return formatDayInArgentina(new Date(start.getTime() + delta * 86_400_000));
}

/** Rango inclusivo `from`/`to` (YYYY-MM-DD) en hora Argentina. */
export function resolveConversionRange(
  query: { from?: string; to?: string },
  defaultSpanDays = 7
): { from: Date; to: Date; fromDay: string; toDay: string } {
  const today = formatDayInArgentina();
  const toDayRaw = query.to?.trim().slice(0, 10);
  const toDay = toDayRaw && isValidDayString(toDayRaw) ? toDayRaw : today;

  const fromDayRaw = query.from?.trim().slice(0, 10);
  const fromDay =
    fromDayRaw && isValidDayString(fromDayRaw)
      ? fromDayRaw
      : addDaysToDayString(toDay, -(defaultSpanDays - 1));

  return {
    from: argentinaDayStartUtc(fromDay),
    to: argentinaDayEndUtc(toDay),
    fromDay,
    toDay,
  };
}
