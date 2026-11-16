import { describe, expect, it } from 'vitest';
import type { Category } from '../../types/finance';
import { createCategorizerWithUserRules } from './categorizer';

const categories: Category[] = [
  { id: 'food', name: 'Food', kind: 'expense' },
  { id: 'fun', name: 'Fun', kind: 'expense' },
  { id: 'pay', name: 'Pay', kind: 'income' },
];

describe('createCategorizerWithUserRules', () => {
  it('lets a user rule beat a built-in rule, even a longer one', () => {
    const categorize = createCategorizerWithUserRules(
      categories,
      [{ keyword: 'fresh', categoryId: 'fun' }],
      [{ keyword: 'fresh market', categoryId: 'food' }],
    );
    expect(categorize('Fresh Market', 'expense')).toEqual({ categoryId: 'fun', keyword: 'fresh', source: 'yours' });
  });

  it('falls back to the built-in rules when no user rule matches', () => {
    const categorize = createCategorizerWithUserRules(
      categories,
      [{ keyword: 'bean barn', categoryId: 'fun' }],
      [{ keyword: 'grocery', categoryId: 'food' }],
    );
    expect(categorize('Weekly grocery run', 'expense')).toEqual({
      categoryId: 'food',
      keyword: 'grocery',
      source: 'built-in',
    });
  });

  it('returns null when nothing matches', () => {
    const categorize = createCategorizerWithUserRules(categories, [], [{ keyword: 'grocery', categoryId: 'food' }]);
    expect(categorize('Something else', 'expense')).toBeNull();
  });

  it('skips a user rule whose category no longer exists', () => {
    const categorize = createCategorizerWithUserRules(
      categories,
      [{ keyword: 'grocery', categoryId: 'deleted' }],
      [{ keyword: 'grocery', categoryId: 'food' }],
    );
    expect(categorize('grocery', 'expense')?.source).toBe('built-in');
  });

  it('only uses user rules of the right kind', () => {
    const categorize = createCategorizerWithUserRules(categories, [{ keyword: 'acme', categoryId: 'pay' }], []);
    expect(categorize('Acme', 'income')?.categoryId).toBe('pay');
    expect(categorize('Acme', 'expense')).toBeNull();
  });
});