import { describe, expect, it } from 'vitest';
import type { Category } from '../../types/finance';
import { createCategorizer, normalizeForMatching, type KeywordRule } from './categorizer';

const categories: Category[] = [
  { id: 'food', name: 'Food', kind: 'expense' },
  { id: 'fun', name: 'Fun', kind: 'expense' },
  { id: 'pay', name: 'Pay', kind: 'income' },
];

function categorizerFor(rules: KeywordRule[]) {
  return createCategorizer(categories, rules);
}

describe('normalizeForMatching', () => {
  it.each([
    ["Trader Joe's #442", 'trader joe s 442'],
    ['  CAFÉ   Luna ', 'cafe luna'],
    ['UBER *EATS Help.uber.com', 'uber eats help uber com'],
    ['', ''],
    ['!!!', ''],
  ])('turns "%s" into "%s"', (text, expected) => {
    expect(normalizeForMatching(text)).toBe(expected);
  });
});

describe('createCategorizer', () => {
  it('matches whole words only', () => {
    const categorize = categorizerFor([{ keyword: 'rent', categoryId: 'food' }]);
    expect(categorize('Rent payment', 'expense')?.categoryId).toBe('food');
    expect(categorize('Car rental', 'expense')).toBeNull();
    expect(categorize('Apparent error', 'expense')).toBeNull();
  });

  it('ignores capitals, punctuation and accents', () => {
    const categorize = categorizerFor([
      { keyword: 'grocery', categoryId: 'food' },
      { keyword: 'cafe', categoryId: 'fun' },
    ]);
    expect(categorize('GROCERY!!!', 'expense')?.categoryId).toBe('food');
    expect(categorize('CAFÉ Luna', 'expense')?.categoryId).toBe('fun');
  });

  it('matches keywords made of several words', () => {
    const categorize = categorizerFor([{ keyword: 'trader joe', categoryId: 'food' }]);
    expect(categorize("Trader Joe's #442", 'expense')?.categoryId).toBe('food');
    expect(categorize('Trader Mike', 'expense')).toBeNull();
  });

  it('lets the longest matching keyword win', () => {
    const categorize = categorizerFor([
      { keyword: 'fresh', categoryId: 'food' },
      { keyword: 'fresh market', categoryId: 'fun' },
    ]);
    expect(categorize('Fresh Market', 'expense')).toEqual({ categoryId: 'fun', keyword: 'fresh market' });
    expect(categorize('Fresh bread', 'expense')?.categoryId).toBe('food');
  });

  it('prefers the earlier rule when keywords tie', () => {
    const categorize = categorizerFor([
      { keyword: 'fresh', categoryId: 'food' },
      { keyword: 'fresh', categoryId: 'fun' },
    ]);
    expect(categorize('fresh', 'expense')?.categoryId).toBe('food');
  });

  it('only suggests categories of the right kind', () => {
    const categorize = categorizerFor([{ keyword: 'interest', categoryId: 'pay' }]);
    expect(categorize('Interest payment', 'income')?.categoryId).toBe('pay');
    expect(categorize('Loan interest', 'expense')).toBeNull();
  });

  it('skips rules for categories that do not exist and rules with empty keywords', () => {
    const categorize = categorizerFor([
      { keyword: 'ghost', categoryId: 'deleted-category' },
      { keyword: '  ', categoryId: 'food' },
      { keyword: '!!!', categoryId: 'food' },
    ]);
    expect(categorize('ghost town', 'expense')).toBeNull();
    expect(categorize('anything at all', 'expense')).toBeNull();
  });

  it('reports which keyword matched, and returns null for empty text', () => {
    const categorize = categorizerFor([{ keyword: 'Grocery', categoryId: 'food' }]);
    expect(categorize('Weekly grocery run', 'expense')).toEqual({ categoryId: 'food', keyword: 'grocery' });
    expect(categorize('', 'expense')).toBeNull();
  });
});