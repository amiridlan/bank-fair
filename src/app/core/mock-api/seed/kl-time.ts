/**
 * Date helpers for Asia/Kuala_Lumpur (GMT+8, no daylight saving).
 *
 * Seed data is generated relative to "today" so the demo always has a live
 * fair, an upcoming one and a past one. Every timestamp is written as ISO 8601
 * carrying the `+08:00` offset, which is what the Laravel API will return.
 */

const KL_OFFSET_MS = 8 * 60 * 60 * 1000;
const KL_OFFSET = '+08:00';

interface KlDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/**
 * The calendar day in Kuala Lumpur, `offsetDays` from today.
 *
 * Shifting the instant by +8h and then reading the UTC fields gives KL's
 * calendar date regardless of where the browser actually is.
 */
export function klDay(offsetDays: number, now: number = Date.now()): KlDay {
  const shifted = new Date(now + KL_OFFSET_MS + offsetDays * 24 * 60 * 60 * 1000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** ISO 8601 timestamp in KL, e.g. `2026-09-21T10:00:00+08:00`. */
export function klTimestamp(
  offsetDays: number,
  hour = 0,
  minute = 0,
  now: number = Date.now(),
): string {
  const { year, month, day } = klDay(offsetDays, now);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${KL_OFFSET}`;
}

/** The current year in KL — used for graduation year ranges. */
export function klYear(now: number = Date.now()): number {
  return klDay(0, now).year;
}
