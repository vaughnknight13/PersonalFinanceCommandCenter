import { describe, expect, it } from 'vitest';
import { pluralize } from './plural';

describe('pluralize', () => {
  it.each([
    [0, '0 transactions'],
    [1, '1 transaction'],
    [2, '2 transactions'],
  ])('writes %i as "%s"', (count, expected) => {
    expect(pluralize(count, 'transaction')).toBe(expected);
  });

  it('accepts an irregular plural', () => {
    expect(pluralize(1, 'category', 'categories')).toBe('1 category');
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
  });
});