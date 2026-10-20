import type { Cents } from '../types/primitives';

// Largest amount we accept: $999,999,999.99. Keeps all sums far below
// Number.MAX_SAFE_INTEGER, so integer math stays exact.
export const MAX_CENTS: Cents = 99_999_999_999;

export type MoneyParseResult =
  | { ok: true; cents: Cents }
  | { ok: false; error: string };

// Digits with optional thousands commas, then optional 1-2 decimal places.
// Matches "12", "1,234", "1234.5", ".50". Rejects "1,23", "12.345", "12.".
const AMOUNT_PATTERN = /^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d{1,2})?$/;

function fail(error: string): MoneyParseResult {
  return { ok: false, error };
}

// Converts text like "$1,234.50", "-12.34" or "(12.34)" into signed cents.
// Returns a result object instead of throwing, so form code can show the
// error message next to the field without try/catch.
export function parseMoneyToCents(input: string): MoneyParseResult {
  let text = input.trim();
  if (text === '') {
    return fail('Enter an amount.');
  }

  // Bank exports often write negatives as (12.34).
  let isNegative = false;
  const hasParentheses = text.startsWith('(') && text.endsWith(')');
  if (hasParentheses) {
    isNegative = true;
    text = text.slice(1, -1).trim();
  }

  if (text.startsWith('-') || text.startsWith('+')) {
    if (hasParentheses) {
      return fail('Use either parentheses or a minus sign, not both.');
    }
    isNegative = text.startsWith('-');
    text = text.slice(1).trim();
  }

  if (text.startsWith('$')) {
    text = text.slice(1).trim();
  }

  if (!/\d/.test(text) || !AMOUNT_PATTERN.test(text)) {
    return fail('Enter a valid amount, such as 12.34 (at most two decimal places).');
  }

  // Split into dollars and cents as text, so no decimal math is ever done.
  const [wholePart = '', decimalPart = ''] = text.replace(/,/g, '').split('.');
  const dollars = wholePart === '' ? 0 : Number(wholePart);
  const centsPart = Number(decimalPart.padEnd(2, '0')); // "5" -> "50"

  const magnitude = dollars * 100 + centsPart;
  if (!Number.isSafeInteger(magnitude) || magnitude > MAX_CENTS) {
    return fail('That amount is too large.');
  }

  // Avoid returning -0 for input like "-0.00".
  return { ok: true, cents: isNegative && magnitude !== 0 ? -magnitude : magnitude };
}

// Intl handles the currency symbol, commas and negative sign for display.
// Dividing by 100 here is safe because the result is only shown, never summed.
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCents(cents: Cents): string {
  return currencyFormatter.format(cents / 100);
}

// Plain "1234.50" text for pre-filling an edit form (no symbol, no commas).
export function centsToInputString(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}${dollars}.${String(remainder).padStart(2, '0')}`;
}