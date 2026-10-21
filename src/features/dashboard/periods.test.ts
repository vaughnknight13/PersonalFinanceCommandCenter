import { describe, expect, it } from 'vitest';
import { monthRange, presetRange } from './periods';

describe('presetRange', () => {
  it('returns the whole current month', () => {
    expect(presetRange('this-month', '2026-10-20')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });

  it('returns the previous month, even from the 31st', () => {
    expect(presetRange('last-month', '2026-03-31')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('crosses the year boundary', () => {
    expect(presetRange('last-month', '2026-01-15')).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('includes the leap day when the previous month is a leap February', () => {
    expect(presetRange('last-month', '2028-03-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
});

describe('monthRange', () => {
  it('covers the month containing any date in it', () => {
    expect(monthRange('2026-04-17')).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });
});