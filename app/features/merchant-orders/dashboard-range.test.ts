import { describe, expect, it } from 'vitest';
import {
  MAX_RANGE_DAYS,
  presetRange,
  readDays,
  toApiRange,
  utcDay,
  validateDays,
} from './dashboard-range';

const now = new Date('2026-11-13T09:40:00Z');

describe('dashboard date range', () => {
  it('uses the UTC calendar day', () => {
    // 23:30 in Colombo on the 13th is still the 13th in UTC.
    expect(utcDay(new Date('2026-11-13T18:00:00Z'))).toBe('2026-11-13');
    expect(utcDay(new Date('2026-11-13T23:59:59Z'))).toBe('2026-11-13');
  });

  it('builds presets that end today and include it', () => {
    expect(presetRange(1, now)).toEqual({
      fromDay: '2026-11-13',
      toDay: '2026-11-13',
    });
    expect(presetRange(7, now)).toEqual({
      fromDay: '2026-11-07',
      toDay: '2026-11-13',
    });
    expect(presetRange(30, now)).toEqual({
      fromDay: '2026-10-15',
      toDay: '2026-11-13',
    });
  });

  it('turns inclusive days into the API window [from, to)', () => {
    expect(toApiRange({ fromDay: '2026-11-01', toDay: '2026-11-13' })).toEqual({
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-14T00:00:00Z',
    });
    expect(toApiRange({ fromDay: '2026-12-31', toDay: '2026-12-31' }).to).toBe(
      '2027-01-01T00:00:00Z',
    );
  });

  it('accepts exactly the maximum length', () => {
    expect(validateDays({ fromDay: '2026-01-01', toDay: '2027-01-01' })).toBe(
      '',
    );
    expect(MAX_RANGE_DAYS).toBe(366);
  });

  it.each([
    [{ fromDay: '2026-01-01', toDay: '2027-01-02' }, /at most 366 days/],
    [{ fromDay: '2026-11-14', toDay: '2026-11-13' }, /on or after/],
    [{ fromDay: '2026-02-31', toDay: '2026-03-01' }, /valid/],
    [{ fromDay: '', toDay: '2026-11-13' }, /valid/],
    [{ fromDay: '13/11/2026', toDay: '2026-11-13' }, /valid/],
  ])('rejects %o', (days, message) => {
    expect(validateDays(days)).toMatch(message);
  });

  it('reads a valid range from the URL', () => {
    expect(
      readDays(new URLSearchParams('from=2026-11-01&to=2026-11-13'), now),
    ).toEqual({
      fromDay: '2026-11-01',
      toDay: '2026-11-13',
    });
  });

  it('falls back to today for missing or invalid URL values', () => {
    const today = { fromDay: '2026-11-13', toDay: '2026-11-13' };
    expect(readDays(new URLSearchParams(''), now)).toEqual(today);
    expect(
      readDays(new URLSearchParams('from=2020-01-01&to=2026-11-13'), now),
    ).toEqual(today);
    expect(
      readDays(new URLSearchParams('from=yesterday&to=today'), now),
    ).toEqual(today);
  });
});
