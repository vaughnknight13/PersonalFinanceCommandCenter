import type { IsoDate } from '../types/primitives';

// Why strings and not Date objects? new Date("2026-03-08") is parsed as UTC
// midnight, which can display as the previous day in US time zones. A plain
// "YYYY-MM-DD" string has no time zone, and strings in this format sort
// correctly as text, so range checks are simple comparisons.

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1900; // sanity bounds that catch typos like "0206-05-01"
const MAX_YEAR = 2100;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Day 0 of the *next* month is the last day of this month.
// UTC is used so daylight saving time can never shift the answer.
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Returns the parts of a valid date, or null if the text is not a real date.
export function parseIsoDate(value: string): DateParts | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const [, yearText = '', monthText = '', dayText = ''] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatIsoDate({ year, month, day }: DateParts): IsoDate {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

// The helpers below assume a valid date. Validate user input with
// isValidIsoDate first; passing a bad date is a programming error, so it throws.
function requireParts(date: IsoDate): DateParts {
  const parts = parseIsoDate(date);
  if (parts === null) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  return parts;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = requireParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

// Moves by whole months, keeping the day of month when possible and
// clamping to the last day otherwise (Jan 31 + 1 month = Feb 28 or 29).
// For repeating schedules, always call this with the ORIGINAL start date
// and an increasing month count. Chaining from the previous result would
// drift (Jan 31 -> Feb 28 -> Mar 28 instead of Mar 31).
export function addMonthsClamped(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = requireParts(date);
  const monthIndex = year * 12 + (month - 1) + months;
  const newYear = Math.floor(monthIndex / 12);
  const newMonth = monthIndex - newYear * 12 + 1;
  const newDay = Math.min(day, daysInMonth(newYear, newMonth));
  return formatIsoDate({ year: newYear, month: newMonth, day: newDay });
}

export function startOfMonth(date: IsoDate): IsoDate {
  const { year, month } = requireParts(date);
  return formatIsoDate({ year, month, day: 1 });
}

export function endOfMonth(date: IsoDate): IsoDate {
  const { year, month } = requireParts(date);
  return formatIsoDate({ year, month, day: daysInMonth(year, month) });
}

// Inclusive on both ends. Plain string comparison works for YYYY-MM-DD.
export function isDateInRange(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end;
}

// "Now" is a parameter so tests can pass a fixed date instead of depending
// on the real clock. Uses the user's local calendar day.
export function todayIso(now: Date = new Date()): IsoDate {
  return formatIsoDate({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}