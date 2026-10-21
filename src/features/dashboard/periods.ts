import type { IsoDate } from '../../types/primitives';
import { addMonthsClamped, endOfMonth, startOfMonth, type DateRange } from '../../utils/dates';

export type PeriodPreset = 'this-month' | 'last-month';

// The whole calendar month containing the given date.
export function monthRange(dateInMonth: IsoDate): DateRange {
  return { start: startOfMonth(dateInMonth), end: endOfMonth(dateInMonth) };
}

// "Custom" ranges come from makeDateRange in utils/dates.ts.
export function presetRange(preset: PeriodPreset, today: IsoDate): DateRange {
  const thisMonth = monthRange(today);
  if (preset === 'this-month') {
    return thisMonth;
  }
  return monthRange(addMonthsClamped(thisMonth.start, -1));
}