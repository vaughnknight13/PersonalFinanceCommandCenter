import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsClamped,
  endOfMonth,
  isDateInRange,
  isValidIsoDate,
  startOfMonth,
  todayIso,
} from './dates';

describe('isValidIsoDate', () => {
  it.each(['2026-10-20', '2028-02-29', '2000-02-29', '1900-01-01', '2100-12-31'])(
    'accepts %s',
    (value) => {
      expect(isValidIsoDate(value)).toBe(true);
    },
  );

  it.each([
    '',
    '2026-02-29', // not a leap year
    '2100-02-29', // century years are leap only if divisible by 400
    '1900-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-1-5',
    '20261020',
    '2026-10-20T00:00:00',
    '0206-05-01',
    '2101-01-01',
    'abcd-ef-gh',
  ])('rejects "%s"', (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });
});

describe('addDays', () => {
  it.each([
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-03-08', 1, '2026-03-09'], // US daylight saving starts
    ['2026-11-01', 1, '2026-11-02'], // US daylight saving ends
    ['2026-10-20', 365, '2027-10-20'],
    ['2026-10-20', 0, '2026-10-20'],
  ])('%s plus %i days is %s', (start, days, expected) => {
    expect(addDays(start, days)).toBe(expected);
  });

  it('throws on an invalid date', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Invalid ISO date');
  });
});

describe('addMonthsClamped', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-01-31', 2, '2026-03-31'], // computed from the start, so no drift
    ['2026-03-31', -1, '2026-02-28'],
    ['2026-11-15', 3, '2027-02-15'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-01-15', -2, '2025-11-15'],
    ['2028-02-29', 12, '2029-02-28'], // yearly schedule from a leap day
    ['2026-10-20', 0, '2026-10-20'],
  ])('%s plus %i months is %s', (start, months, expected) => {
    expect(addMonthsClamped(start, months)).toBe(expected);
  });
});

describe('startOfMonth and endOfMonth', () => {
  it('finds month boundaries, including leap February', () => {
    expect(startOfMonth('2026-02-17')).toBe('2026-02-01');
    expect(endOfMonth('2026-02-17')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-05')).toBe('2026-12-31');
  });
});

describe('isDateInRange', () => {
  it('includes both boundary dates', () => {
    expect(isDateInRange('2026-10-01', '2026-10-01', '2026-10-31')).toBe(true);
    expect(isDateInRange('2026-10-31', '2026-10-01', '2026-10-31')).toBe(true);
  });

  it('excludes dates outside the range', () => {
    expect(isDateInRange('2026-09-30', '2026-10-01', '2026-10-31')).toBe(false);
    expect(isDateInRange('2026-11-01', '2026-10-01', '2026-10-31')).toBe(false);
  });
});

describe('todayIso', () => {
  it('uses the local calendar day of the date it is given', () => {
    expect(todayIso(new Date(2026, 9, 20, 23, 59))).toBe('2026-10-20');
    expect(todayIso(new Date(2028, 1, 29, 0, 0))).toBe('2028-02-29');
  });
});