export const STORE_TIMEZONE = 'Asia/Bangkok';

const bangkokDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: STORE_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const thaiShortDateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: STORE_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

const thaiTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: STORE_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const utcThaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseValidDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Convert a Date or ISO timestamp into a 'YYYY-MM-DD' key in Asia/Bangkok.
 * Plain 'YYYY-MM-DD' strings are returned unchanged.
 */
export function toBangkokDateKey(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (DATE_KEY_RE.test(trimmed)) return trimmed;
  }
  const d = parseValidDate(value);
  if (!d) return '';

  const parts = bangkokDateFormatter.formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey() {
  return toBangkokDateKey(new Date());
}

/**
 * Shift a 'YYYY-MM-DD' date key by N days using UTC calendar math (DST/timezone-safe).
 */
export function shiftDateKey(dateKey, days) {
  const match = DATE_KEY_RE.exec(String(dateKey ?? '').trim());
  if (!match) return getTodayDateKey();
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]) + days;
  const shifted = new Date(Date.UTC(y, m, d));
  const yy = String(shifted.getUTCFullYear()).padStart(4, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function isDateKeyOlderThanDays(dateKey, days) {
  const normalized = toBangkokDateKey(dateKey);
  if (!normalized) return false;
  const cutoffKey = shiftDateKey(getTodayDateKey(), -days);
  return normalized < cutoffKey;
}

export function formatThaiDate(value) {
  if (typeof value === 'string') {
    const match = DATE_KEY_RE.exec(value.trim());
    if (match) {
      const utcMidnight = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      return utcThaiDateFormatter.format(utcMidnight);
    }
  }
  const d = parseValidDate(value);
  return d ? thaiDateFormatter.format(d) : '-';
}

export function formatThaiTime(value) {
  const d = parseValidDate(value);
  return d ? thaiTimeFormatter.format(d) : '-';
}

export function formatThaiDateTime(value, { shortYear = false } = {}) {
  const d = parseValidDate(value);
  if (!d) return '-';
  const datePart = shortYear ? thaiShortDateFormatter.format(d) : thaiDateFormatter.format(d);
  return `${datePart} ${thaiTimeFormatter.format(d)}`;
}
