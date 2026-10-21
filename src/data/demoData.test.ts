import { describe, expect, it } from 'vitest';
import { validateAppData } from '../services/appDataValidation';
import { addMonthsClamped, startOfMonth } from '../utils/dates';
import { createDemoData } from './demoData';
import { DEFAULT_CATEGORIES } from './defaultCategories';
import { createEmptyData } from './emptyData';

describe('createDemoData', () => {
  it.each(['2026-10-20', '2028-02-29', '2026-01-31', '2026-03-01', '2026-12-31', '2026-10-01'])(
    'creates data that passes full validation for %s',
    (today) => {
      const result = validateAppData(createDemoData(today));
      if (!result.ok) {
        throw new Error(result.errors.join('\n'));
      }
      expect(result.data.isDemo).toBe(true);
    },
  );

  it('gives identical results for the same date', () => {
    expect(createDemoData('2026-10-20')).toEqual(createDemoData('2026-10-20'));
  });

  it('never creates future-dated transactions', () => {
    const today = '2026-10-20';
    for (const transaction of createDemoData(today).transactions) {
      expect(transaction.date <= today).toBe(true);
    }
  });

  it('starts at the beginning of the month five months back, in date order', () => {
    const { transactions } = createDemoData('2026-10-20');
    expect(transactions[0]?.date).toBe('2026-05-01');

    const dates = transactions.map((transaction) => transaction.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('contains income, expenses and uncategorized transfers', () => {
    const { transactions } = createDemoData('2026-10-20');
    expect(transactions.length).toBeGreaterThan(100);
    expect(transactions.some((transaction) => transaction.type === 'income')).toBe(true);
    expect(transactions.some((transaction) => transaction.type === 'expense')).toBe(true);

    const transfers = transactions.filter((transaction) => transaction.type === 'transfer');
    expect(transfers.length).toBeGreaterThan(0);
    for (const transfer of transfers) {
      expect(transfer.categoryId).toBeNull();
      expect(transfer.toAccountId).toBeDefined();
    }
  });

  it('sets goal target dates relative to today', () => {
    const goals = createDemoData('2026-10-20').savingsGoals;
    expect(goals.map((goal) => goal.targetDate)).toContain(addMonthsClamped('2026-10-20', 10));
    expect(goals.every((goal) => goal.targetDate > startOfMonth('2026-10-20'))).toBe(true);
  });
});

describe('createEmptyData', () => {
  it('is valid, has the default categories and one empty account', () => {
    const data = createEmptyData();
    expect(validateAppData(data).ok).toBe(true);
    expect(data.isDemo).toBe(false);
    expect(data.categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(data.accounts).toHaveLength(1);
    expect(data.transactions).toHaveLength(0);
  });
});