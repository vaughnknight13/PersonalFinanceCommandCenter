import { describe, expect, it } from 'vitest';
import {
  accountSchema,
  budgetSchema,
  recurringItemSchema,
  savingsGoalSchema,
  transactionSchema,
} from './finance';

interface ParseFailure {
  success: false;
  error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }> };
}

// The field names that failed validation, e.g. ["amountCents"].
function failedPaths(result: { success: true } | ParseFailure): string[] {
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => issue.path.map(String).join('.'));
}

const validExpense = {
  id: 't-1',
  date: '2026-10-20',
  description: 'Coffee',
  amountCents: 450,
  type: 'expense',
  categoryId: 'cat-dining',
  accountId: 'acct-1',
};

const validTransfer = {
  id: 't-2',
  date: '2026-10-20',
  description: 'Save',
  amountCents: 5_000,
  type: 'transfer',
  categoryId: null,
  accountId: 'acct-1',
  toAccountId: 'acct-2',
};

describe('transactionSchema', () => {
  it('accepts a valid expense and a valid transfer', () => {
    expect(transactionSchema.safeParse(validExpense).success).toBe(true);
    expect(transactionSchema.safeParse(validTransfer).success).toBe(true);
    expect(transactionSchema.safeParse({ ...validTransfer, goalId: 'goal-1' }).success).toBe(true);
  });

  it('trims text and drops unknown fields', () => {
    const result = transactionSchema.safeParse({ ...validExpense, description: '  Coffee  ', extra: 'x' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Coffee');
      expect(result.data).not.toHaveProperty('extra');
    }
  });

  it('keeps markup-like text as plain text', () => {
    const description = '<img src=x onerror=alert(1)>';
    const result = transactionSchema.safeParse({ ...validExpense, description });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe(description);
    }
  });

  it.each(['2026-02-30', '', '10/20/2026', '2026-13-01'])('rejects the date "%s"', (date) => {
    expect(failedPaths(transactionSchema.safeParse({ ...validExpense, date }))).toContain('date');
  });

  it.each(['', '   '])('rejects the description "%s"', (description) => {
    expect(failedPaths(transactionSchema.safeParse({ ...validExpense, description }))).toContain('description');
  });

  it.each([0, -5, 12.5, 100_000_000_000, Number.NaN])('rejects the amount %s', (amountCents) => {
    expect(failedPaths(transactionSchema.safeParse({ ...validExpense, amountCents }))).toContain('amountCents');
  });

  it('requires a category for income and expenses', () => {
    expect(failedPaths(transactionSchema.safeParse({ ...validExpense, categoryId: null }))).toContain('categoryId');
  });

  it('requires transfers to have two different accounts and no category', () => {
    const { toAccountId: _removed, ...withoutDestination } = validTransfer;
    expect(failedPaths(transactionSchema.safeParse(withoutDestination))).toContain('toAccountId');
    expect(failedPaths(transactionSchema.safeParse({ ...validTransfer, toAccountId: 'acct-1' }))).toContain('toAccountId');
    expect(failedPaths(transactionSchema.safeParse({ ...validTransfer, categoryId: 'cat-dining' }))).toContain('categoryId');
  });

  it('only allows a destination account or goal on transfers', () => {
    expect(failedPaths(transactionSchema.safeParse({ ...validExpense, toAccountId: 'acct-2' }))).toContain('toAccountId');
    expect(failedPaths(transactionSchema.safeParse({ ...validExpense, goalId: 'goal-1' }))).toContain('goalId');
  });
});

describe('recurringItemSchema', () => {
  const validRecurring = {
    id: 'rec-1',
    description: 'Rent',
    amountCents: 145_000,
    type: 'expense',
    categoryId: 'cat-housing',
    accountId: 'acct-1',
    frequency: 'monthly',
    startDate: '2026-01-01',
    active: true,
  };

  it('accepts a valid item, with or without an end date', () => {
    expect(recurringItemSchema.safeParse(validRecurring).success).toBe(true);
    expect(recurringItemSchema.safeParse({ ...validRecurring, endDate: '2026-12-01' }).success).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    expect(failedPaths(recurringItemSchema.safeParse({ ...validRecurring, endDate: '2025-12-31' }))).toContain('endDate');
  });

  it('rejects unsupported frequencies and incomplete transfers', () => {
    expect(failedPaths(recurringItemSchema.safeParse({ ...validRecurring, frequency: 'daily' }))).toContain('frequency');
    expect(
      failedPaths(recurringItemSchema.safeParse({ ...validRecurring, type: 'transfer', categoryId: null })),
    ).toContain('toAccountId');
  });
});

describe('savingsGoalSchema', () => {
  const validGoal = {
    id: 'goal-1',
    name: 'Trip',
    targetCents: 100_000,
    initialSavedCents: 0,
    targetDate: '2027-06-01',
  };

  it('accepts a goal, including one whose target date has already passed', () => {
    expect(savingsGoalSchema.safeParse(validGoal).success).toBe(true);
    expect(savingsGoalSchema.safeParse({ ...validGoal, targetDate: '2020-01-01' }).success).toBe(true);
  });

  it('rejects zero or negative targets, negative saved amounts and bad dates', () => {
    expect(failedPaths(savingsGoalSchema.safeParse({ ...validGoal, targetCents: 0 }))).toContain('targetCents');
    expect(failedPaths(savingsGoalSchema.safeParse({ ...validGoal, targetCents: -100 }))).toContain('targetCents');
    expect(failedPaths(savingsGoalSchema.safeParse({ ...validGoal, initialSavedCents: -1 }))).toContain('initialSavedCents');
    expect(failedPaths(savingsGoalSchema.safeParse({ ...validGoal, targetDate: '2027-02-30' }))).toContain('targetDate');
  });
});

describe('budgetSchema and accountSchema', () => {
  it('rejects a budget limit of zero', () => {
    expect(failedPaths(budgetSchema.safeParse({ categoryId: 'cat-food', monthlyLimitCents: 0 }))).toContain('monthlyLimitCents');
  });

  it('allows a negative opening balance but not an unknown account kind', () => {
    const account = { id: 'a', name: 'Card', kind: 'credit', openingBalanceCents: -25_000 };
    expect(accountSchema.safeParse(account).success).toBe(true);
    expect(failedPaths(accountSchema.safeParse({ ...account, kind: 'crypto' }))).toContain('kind');
  });
});