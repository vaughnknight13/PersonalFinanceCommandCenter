import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types/finance';
import { describeAccounts, describeCategory, formatTransactionAmount, transactionTypeLabel } from './display';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't',
    date: '2026-10-10',
    description: 'Item',
    amountCents: 123_456,
    type: 'expense',
    categoryId: 'cat-food',
    accountId: 'a1',
    ...overrides,
  };
}

const accountNames = new Map([
  ['a1', 'Checking'],
  ['a2', 'Savings'],
]);
const categoryNames = new Map([['cat-food', 'Food']]);

describe('formatTransactionAmount', () => {
  it('signs income and expenses and leaves transfers unsigned', () => {
    expect(formatTransactionAmount(tx({ type: 'income' }))).toBe('+$1,234.56');
    expect(formatTransactionAmount(tx({ type: 'expense' }))).toBe('-$1,234.56');
    expect(formatTransactionAmount(tx({ type: 'transfer', categoryId: null }))).toBe('$1,234.56');
  });
});

describe('describeAccounts', () => {
  it('shows one account for income and expenses', () => {
    expect(describeAccounts(tx({}), accountNames)).toBe('Checking');
  });

  it('shows both accounts for a transfer', () => {
    const transfer = tx({ type: 'transfer', categoryId: null, toAccountId: 'a2' });
    expect(describeAccounts(transfer, accountNames)).toBe('Checking → Savings');
  });

  it('copes with accounts that are missing', () => {
    expect(describeAccounts(tx({ accountId: 'gone' }), accountNames)).toBe('Unknown account');
  });
});

describe('describeCategory and transactionTypeLabel', () => {
  it('names the category, or says there is none', () => {
    expect(describeCategory(tx({}), categoryNames)).toBe('Food');
    expect(describeCategory(tx({ categoryId: null }), categoryNames)).toBe('None');
    expect(describeCategory(tx({ categoryId: 'gone' }), categoryNames)).toBe('Unknown category');
  });

  it('labels each type', () => {
    expect(transactionTypeLabel('income')).toBe('Income');
    expect(transactionTypeLabel('expense')).toBe('Expense');
    expect(transactionTypeLabel('transfer')).toBe('Transfer');
  });
});