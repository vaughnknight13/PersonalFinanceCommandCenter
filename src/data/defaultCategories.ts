import type { Category } from '../types/finance';

// Transfers have no category, so there is no "transfer" category here.
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'cat-housing', name: 'Housing', kind: 'expense' },
  { id: 'cat-utilities', name: 'Utilities', kind: 'expense' },
  { id: 'cat-groceries', name: 'Groceries', kind: 'expense' },
  { id: 'cat-dining', name: 'Dining', kind: 'expense' },
  { id: 'cat-transportation', name: 'Transportation', kind: 'expense' },
  { id: 'cat-subscriptions', name: 'Subscriptions', kind: 'expense' },
  { id: 'cat-insurance', name: 'Insurance', kind: 'expense' },
  { id: 'cat-health', name: 'Health', kind: 'expense' },
  { id: 'cat-shopping', name: 'Shopping', kind: 'expense' },
  { id: 'cat-entertainment', name: 'Entertainment', kind: 'expense' },
  { id: 'cat-other-expense', name: 'Other', kind: 'expense' },
  { id: 'cat-salary', name: 'Salary', kind: 'income' },
  { id: 'cat-interest', name: 'Interest', kind: 'income' },
  { id: 'cat-refunds', name: 'Refunds', kind: 'income' },
  { id: 'cat-other-income', name: 'Other Income', kind: 'income' },
];