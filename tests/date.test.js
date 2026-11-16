import { describe, it, expect } from 'vitest';
import {
  toBangkokDateKey,
  shiftDateKey,
  isDateKeyOlderThanDays,
  formatThaiDate,
  formatThaiTime,
  formatThaiDateTime
} from '../src/utils/date';

describe('date utilities (Asia/Bangkok)', () => {
  it('converts UTC timestamp after 17:00 UTC to next Bangkok calendar day', () => {
    // 2026-03-10 17:30:00 UTC = 2026-03-11 00:30:00 ICT (Bangkok)
    expect(toBangkokDateKey('2026-03-10T17:30:00.000Z')).toBe('2026-03-11');
    // 2026-03-10 16:59:59 UTC = 2026-03-10 23:59:59 ICT (Bangkok)
    expect(toBangkokDateKey('2026-03-10T16:59:59.000Z')).toBe('2026-03-10');
  });

  it('preserves bare YYYY-MM-DD keys without UTC shifting', () => {
    expect(toBangkokDateKey('2026-01-01')).toBe('2026-01-01');
  });

  it('returns empty string for invalid or empty input', () => {
    expect(toBangkokDateKey('')).toBe('');
    expect(toBangkokDateKey(null)).toBe('');
    expect(toBangkokDateKey('not-a-date')).toBe('');
  });

  it('shifts date keys cleanly across month and year boundaries', () => {
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKey('2024-02-28', 1)).toBe('2024-02-29'); // leap year
    expect(shiftDateKey('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('checks whether date key is older than N days using deterministic reference date', () => {
    const ref = new Date('2026-04-10T05:00:00.000Z'); // 2026-04-10 Bangkok
    expect(isDateKeyOlderThanDays('2026-03-10', 30, ref)).toBe(true);
    expect(isDateKeyOlderThanDays('2026-03-11', 30, ref)).toBe(false);
    expect(isDateKeyOlderThanDays('2026-04-10', 30, ref)).toBe(false);
  });

  it('formats Thai date and time gracefully and handles invalid values', () => {
    expect(formatThaiDate('2026-03-10T17:30:00.000Z')).toContain('11');
    expect(formatThaiTime('2026-03-10T17:30:00.000Z')).toMatch(/00:30/);
    expect(formatThaiDateTime('')).toBe('-');
    expect(formatThaiDateTime('invalid')).toBe('-');
  });
});
