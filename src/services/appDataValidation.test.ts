import { describe, expect, it } from 'vitest';
import { makeValidData } from '../test/fixtures';
import type { AppData, Transaction } from '../types/finance';
import { validateAppData } from './appDataValidation';

function errorsFor(data: unknown): string[] {
  const result = validateAppData(data);
  return result.ok ? [] : result.errors;
}

function withExtraTransactions(extra: Transaction[]): AppData {
  const data = makeValidData();
  return { ...data, transactions: [...data.transactions, ...extra] };
}

const expenseOn = (id: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id,
  date: '2026-10-05',
  description: 'Snack',
  amountCents: 300,
  type: 'expense',
  categoryId: 'cat-food',
  accountId: 'acct-1',
  ...overrides,
});

describe('validateAppData', () => {
  it('accepts valid data', () => {
    expect(validateAppData(makeValidData()).ok).toBe(true);
  });

  it.each([null, 'text', 42, [], {}])('rejects input that is not app data: %j', (input) => {
    expect(validateAppData(input).ok).toBe(false);
  });

  it('reports a missing collection', () => {
    const { transactions: _removed, ...incomplete } = makeValidData();
    expect(errorsFor(incomplete).some((error) => error.startsWith('transactions'))).toBe(true);
  });

  it('reports field-level problems with their location', () => {
    const errors = errorsFor(withExtraTransactions([expenseOn('t-9', { amountCents: -5 })]));
    expect(errors.some((error) => error.includes('amountCents'))).toBe(true);
  });

  it('reports duplicate ids', () => {
    const errors = errorsFor(withExtraTransactions([expenseOn('t-1')]));
    expect(errors).toContain('Duplicate transaction id "t-1".');
  });

  it('reports references to things that do not exist', () => {
    expect(errorsFor(withExtraTransactions([expenseOn('t-9', { accountId: 'nope' })])).join(' ')).toContain(
      'uses an account that does not exist',
    );
    expect(errorsFor(withExtraTransactions([expenseOn('t-9', { categoryId: 'nope' })])).join(' ')).toContain(
      'uses a category that does not exist',
    );
    expect(errorsFor(withExtraTransactions([expenseOn('t-9', { recurringId: 'nope' })])).join(' ')).toContain(
      'refers to a recurring item that does not exist',
    );
    const badTransfer = expenseOn('t-9', { type: 'transfer', categoryId: null, toAccountId: 'nope' });
    expect(errorsFor(withExtraTransactions([badTransfer])).join(' ')).toContain(
      'transfers to an account that does not exist',
    );
    const badGoal = expenseOn('t-9', { type: 'transfer', categoryId: null, toAccountId: 'acct-2', goalId: 'nope' });
    expect(errorsFor(withExtraTransactions([badGoal])).join(' ')).toContain(
      'refers to a savings goal that does not exist',
    );
  });

  it('rejects an income transaction that uses an expense category', () => {
    const errors = errorsFor(withExtraTransactions([expenseOn('t-9', { type: 'income' })]));
    expect(errors.join(' ')).toContain('is income but its category "Food" is for expense');
  });

  it('validates budgets', () => {
    const data = makeValidData();
    expect(errorsFor({ ...data, budgets: [...data.budgets, { categoryId: 'cat-food', monthlyLimitCents: 100 }] }).join(' ')).toContain(
      'More than one budget',
    );
    expect(errorsFor({ ...data, budgets: [{ categoryId: 'cat-pay', monthlyLimitCents: 100 }] }).join(' ')).toContain(
      'expense categories only',
    );
    expect(errorsFor({ ...data, budgets: [{ categoryId: 'nope', monthlyLimitCents: 100 }] }).join(' ')).toContain(
      'does not exist',
    );
  });

  it('validates recurring items', () => {
    const data = makeValidData();
    const [first] = data.recurringItems;
    if (first === undefined) {
      throw new Error('fixture should contain a recurring item');
    }
    const errors = errorsFor({ ...data, recurringItems: [{ ...first, accountId: 'nope' }] });
    expect(errors.join(' ')).toContain('Recurring item "rec-1" uses an account that does not exist');
  });

  it('limits how many problems it reports', () => {
    const broken = Array.from({ length: 50 }, (_, index) => expenseOn(`bad-${index}`, { accountId: 'nope' }));
    const errors = errorsFor(withExtraTransactions(broken));
    expect(errors).toHaveLength(21);
    expect(errors[20]).toBe('...and 30 more problems.');
  });
});