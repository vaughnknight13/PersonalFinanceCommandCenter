import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types/finance';
import { EMPTY_FILTERS, filterTransactions, paginate, sortTransactions } from './calculations';

function tx(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    date: '2026-10-10',
    description: 'Item',
    amountCents: 1_000,
    type: 'expense',
    categoryId: 'cat-food',
    accountId: 'acct-1',
    ...overrides,
  };
}

const sample: Transaction[] = [
  tx({ id: 'a', date: '2026-10-01', description: 'Paycheck', merchant: 'Meridian Payroll', amountCents: 200_000, type: 'income', categoryId: 'cat-pay' }),
  tx({ id: 'b', date: '2026-10-02', description: 'Coffee beans', merchant: 'Bean Barn', amountCents: 1_450 }),
  tx({ id: 'c', date: '2026-10-02', description: 'grocery run', merchant: 'Greenfield Market', amountCents: 8_200, categoryId: 'cat-groceries' }),
  tx({ id: 'd', date: '2026-10-15', description: 'Move to savings', amountCents: 30_000, type: 'transfer', categoryId: null, toAccountId: 'acct-2' }),
  tx({ id: 'e', date: '2026-11-01', description: 'Rent', amountCents: 145_000, categoryId: 'cat-housing', accountId: 'acct-2' }),
];

const ids = (transactions: Transaction[]): string[] => transactions.map((transaction) => transaction.id);

describe('filterTransactions', () => {
  it('returns every transaction, in a new array, when no filter is active', () => {
    const result = filterTransactions(sample, EMPTY_FILTERS);
    expect(ids(result)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result).not.toBe(sample);
  });

  it('searches descriptions and merchants without caring about case', () => {
    expect(ids(filterTransactions(sample, { ...EMPTY_FILTERS, searchText: 'GROCERY' }))).toEqual(['c']);
    expect(ids(filterTransactions(sample, { ...EMPTY_FILTERS, searchText: 'bean' }))).toEqual(['b']);
    expect(ids(filterTransactions(sample, { ...EMPTY_FILTERS, searchText: '  rent ' }))).toEqual(['e']);
  });

  it('ignores a search made only of spaces', () => {
    expect(filterTransactions(sample, { ...EMPTY_FILTERS, searchText: '   ' })).toHaveLength(5);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterTransactions(sample, { ...EMPTY_FILTERS, searchText: 'zzz' })).toEqual([]);
  });

  it('filters by type and by category', () => {
    expect(ids(filterTransactions(sample, { ...EMPTY_FILTERS, type: 'transfer' }))).toEqual(['d']);
    expect(ids(filterTransactions(sample, { ...EMPTY_FILTERS, categoryId: 'cat-groceries' }))).toEqual(['c']);
  });

  it('includes transfers into an account when filtering by that account', () => {
    expect(ids(filterTransactions(sample, { ...EMPTY_FILTERS, accountId: 'acct-2' }))).toEqual(['d', 'e']);
  });

  it('includes both boundary dates of a date range', () => {
    const dateRange = { start: '2026-10-02', end: '2026-10-15' };
    expect(ids(filterTransactions(sample, { ...EMPTY_FILTERS, dateRange }))).toEqual(['b', 'c', 'd']);
  });

  it('requires every active filter to match', () => {
    const filters = {
      ...EMPTY_FILTERS,
      type: 'expense' as const,
      dateRange: { start: '2026-10-01', end: '2026-10-31' },
    };
    expect(ids(filterTransactions(sample, filters))).toEqual(['b', 'c']);
  });

  it('does not change the list it was given', () => {
    const before = JSON.stringify(sample);
    filterTransactions(sample, { ...EMPTY_FILTERS, searchText: 'rent' });
    expect(JSON.stringify(sample)).toBe(before);
  });
});

describe('sortTransactions', () => {
  it('sorts by date, using the id to order ties', () => {
    expect(ids(sortTransactions(sample, 'date', 'asc'))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ids(sortTransactions(sample, 'date', 'desc'))).toEqual(['e', 'd', 'b', 'c', 'a']);
  });

  it('sorts by amount', () => {
    expect(ids(sortTransactions(sample, 'amount', 'asc'))).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(ids(sortTransactions(sample, 'amount', 'desc'))).toEqual(['a', 'e', 'd', 'c', 'b']);
  });

  it('sorts by description without caring about case', () => {
    expect(ids(sortTransactions(sample, 'description', 'asc'))).toEqual(['b', 'c', 'd', 'a', 'e']);
  });

  it('breaks ties by id whichever direction is chosen', () => {
    const tied = [tx({ id: 'z', amountCents: 5 }), tx({ id: 'y', amountCents: 5 })];
    expect(ids(sortTransactions(tied, 'amount', 'asc'))).toEqual(['y', 'z']);
    expect(ids(sortTransactions(tied, 'amount', 'desc'))).toEqual(['y', 'z']);
  });

  it('returns a copy and leaves the original order alone', () => {
    const originalOrder = ids(sample);
    sortTransactions(sample, 'amount', 'desc');
    expect(ids(sample)).toEqual(originalOrder);
  });
});

describe('paginate', () => {
  const numbers = Array.from({ length: 25 }, (_, index) => index + 1);

  it('returns the requested page', () => {
    const result = paginate(numbers, 1, 10);
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result).toMatchObject({ page: 1, pageCount: 3, totalItems: 25 });
  });

  it('returns a shorter last page', () => {
    expect(paginate(numbers, 3, 10).items).toEqual([21, 22, 23, 24, 25]);
  });

  it.each([99, 0, -4, Number.NaN, 2.7])('clamps the page number %s into range', (requestedPage) => {
    const { page } = paginate(numbers, requestedPage, 10);
    expect(page).toBeGreaterThanOrEqual(1);
    expect(page).toBeLessThanOrEqual(3);
  });

  it('clamps specific out-of-range values to the first or last page', () => {
    expect(paginate(numbers, 99, 10).page).toBe(3);
    expect(paginate(numbers, 0, 10).page).toBe(1);
    expect(paginate(numbers, Number.NaN, 10).page).toBe(1);
    expect(paginate(numbers, 2.7, 10).page).toBe(2);
  });

  it('handles an empty list as one empty page', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1, totalItems: 0 });
  });

  it('treats a page size below 1 as 1', () => {
    expect(paginate(numbers, 1, 0).pageCount).toBe(25);
  });
});