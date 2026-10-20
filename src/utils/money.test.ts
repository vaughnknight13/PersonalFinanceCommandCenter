import { describe, expect, it } from 'vitest';
import { MAX_CENTS, centsToInputString, formatCents, parseMoneyToCents } from './money';

// Fails the test with a clear message if the input does not parse.
function parseOk(input: string): number {
  const result = parseMoneyToCents(input);
  if (!result.ok) {
    throw new Error(`Expected "${input}" to parse, but got: ${result.error}`);
  }
  return result.cents;
}

describe('parseMoneyToCents', () => {
  it.each([
    ['12.34', 1234],
    ['12', 1200],
    ['12.5', 1250],
    ['.50', 50],
    ['0.05', 5],
    ['$1,234.50', 123450],
    ['  42.00  ', 4200],
    ['-12.34', -1234],
    ['+7.00', 700],
    ['(12.34)', -1234],
    ['-$5', -500],
    ['-0.00', 0],
  ])('parses "%s" as %i cents', (input, expected) => {
    expect(parseOk(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'abc',
    '12.345',
    '1,23',
    '12.',
    '1e3',
    '--5',
    '$',
    '.',
    '(12.34',
    '(-5)',
    '12 34',
    '1000000000.00',
  ])('rejects "%s"', (input) => {
    expect(parseMoneyToCents(input).ok).toBe(false);
  });

  it('accepts the largest allowed amount', () => {
    expect(parseOk('999999999.99')).toBe(MAX_CENTS);
  });

  it('adds exactly, unlike floating-point dollars', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(parseOk('0.10') + parseOk('0.20')).toBe(parseOk('0.30'));
  });
});

describe('formatCents', () => {
  it.each([
    [123450, '$1,234.50'],
    [5, '$0.05'],
    [0, '$0.00'],
    [-1234, '-$12.34'],
    [100000000, '$1,000,000.00'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });
});

describe('centsToInputString', () => {
  it('produces plain decimal text', () => {
    expect(centsToInputString(123450)).toBe('1234.50');
    expect(centsToInputString(5)).toBe('0.05');
    expect(centsToInputString(-1234)).toBe('-12.34');
    expect(centsToInputString(0)).toBe('0.00');
  });

  it.each([0, 5, 99, 100, 1234, 123450, -1234, MAX_CENTS])(
    'round-trips %i cents through text',
    (cents) => {
      expect(parseOk(centsToInputString(cents))).toBe(cents);
    },
  );
});