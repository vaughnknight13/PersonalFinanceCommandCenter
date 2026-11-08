import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types/finance';
import {
  emptyFormValues,
  validateTransactionForm,
  valuesFromTransaction,
  type FormErrors,
  type TransactionFormValues,
} from './transactionFormLogic';

function values(overrides: Partial<TransactionFormValues> = {}): TransactionFormValues {
  return {
    type: 'expense',
    date: '2026-10-20',
    description: 'Coffee',
    amount: '4.50',
    categoryId: 'cat-food',
    accountId: 'acct-1',
    toAccountId: '',
    goalId: '',
    merchant: '',
    notes: '',
    ...overrides,
  };
}

function build(overrides: Partial<TransactionFormValues> = {}, existing?: Transaction): Transaction {
  const result = validateTransactionForm(values(overrides), existing?.id ?? 'new-id', existing);
  if (!result.ok) {
    throw new Error(`Expected the form to be valid: ${JSON.stringify(result.errors)}`);
  }
  return result.transaction;
}

function errorsOf(overrides: Partial<TransactionFormValues> = {}): FormErrors {
  const result = validateTransactionForm(values(overrides), 'new-id', undefined);
  return result.ok ? {} : result.errors;
}

describe('validateTransactionForm: valid input', () => {
  it('builds an expense', () => {
    expect(build()).toEqual({
      id: 'new-id',
      date: '2026-10-20',
      description: 'Coffee',
      amountCents: 450,
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acct-1',
    });
  });

  it.each([
    ['4.5', 450],
    ['$1,234.50', 123_450],
    ['.99', 99],
    ['  12  ', 1_200],
  ])('reads the amount "%s" as %i cents', (amount, expected) => {
    expect(build({ amount }).amountCents).toBe(expected);
  });

  it('builds income', () => {
    const income = build({ type: 'income', categoryId: 'cat-pay' });
    expect(income).toMatchObject({ type: 'income', categoryId: 'cat-pay' });
  });

  it('builds a transfer with no category and an optional goal', () => {
    const transfer = build({ type: 'transfer', categoryId: 'cat-food', toAccountId: 'acct-2', goalId: 'goal-1' });
    expect(transfer).toMatchObject({ type: 'transfer', categoryId: null, toAccountId: 'acct-2', goalId: 'goal-1' });
  });

  it('ignores leftover destination and goal values on income and expenses', () => {
    const expense = build({ toAccountId: 'acct-2', goalId: 'goal-1' });
    expect(expense.toAccountId).toBeUndefined();
    expect(expense.goalId).toBeUndefined();
  });

  it('trims text and leaves out blank optional fields', () => {
    const transaction = build({ description: '  Coffee  ', merchant: ' Bean Barn ', notes: '   ' });
    expect(transaction.description).toBe('Coffee');
    expect(transaction.merchant).toBe('Bean Barn');
    expect(transaction.notes).toBeUndefined();
  });

  it('keeps markup-like text as plain text', () => {
    expect(build({ description: '<script>alert(1)</script>' }).description).toBe('<script>alert(1)</script>');
  });
});

describe('validateTransactionForm: invalid input', () => {
  it.each([
    ['', 'Enter an amount.'],
    ['abc', 'Enter a valid amount'],
    ['12.345', 'Enter a valid amount'],
    ['0', 'Amount must be greater than zero.'],
    ['0.00', 'Amount must be greater than zero.'],
    ['-5', 'without a minus sign'],
    ['(5.00)', 'without a minus sign'],
    ['1000000000.00', 'too large'],
  ])('rejects the amount "%s"', (amount, expectedMessage) => {
    expect(errorsOf({ amount }).amount).toContain(expectedMessage);
  });

  it.each(['', '2026-02-30', '10/20/2026'])('rejects the date "%s"', (date) => {
    expect(errorsOf({ date }).date).toBe('Enter a valid date (YYYY-MM-DD).');
  });

  it.each(['', '   '])('rejects the description "%s"', (description) => {
    expect(errorsOf({ description }).description).toBe('Enter a description.');
  });

  it('limits text lengths', () => {
    expect(errorsOf({ description: 'x'.repeat(201) }).description).toBe('Keep this to 200 characters or fewer.');
    expect(errorsOf({ merchant: 'x'.repeat(101) }).merchant).toBe('Keep this to 100 characters or fewer.');
    expect(errorsOf({ notes: 'x'.repeat(1001) }).notes).toBe('Keep this to 1,000 characters or fewer.');
  });

  it('requires an account', () => {
    expect(errorsOf({ accountId: '' }).accountId).toBe('Choose an account.');
  });

  it('requires a category for income and expenses', () => {
    expect(errorsOf({ categoryId: '' }).categoryId).toBe('Choose a category.');
    expect(errorsOf({ type: 'income', categoryId: '' }).categoryId).toBe('Choose a category.');
  });

  it('requires a transfer to have two different accounts', () => {
    expect(errorsOf({ type: 'transfer', toAccountId: '' }).toAccountId).toBe('Choose the account the money goes to.');
    expect(errorsOf({ type: 'transfer', toAccountId: 'acct-1' }).toAccountId).toBe(
      'A transfer needs two different accounts.',
    );
  });

  it('reports every problem at once', () => {
    const errors = errorsOf({ description: '', amount: '', categoryId: '' });
    expect(errors.description).toBeDefined();
    expect(errors.amount).toBeDefined();
    expect(errors.categoryId).toBeDefined();
  });

  it('returns no transaction when anything is invalid', () => {
    expect(validateTransactionForm(values({ amount: 'abc' }), 'new-id', undefined).ok).toBe(false);
  });
});

describe('validateTransactionForm: editing', () => {
  const existing: Transaction = {
    id: 't-9',
    date: '2026-10-01',
    description: 'Rent',
    amountCents: 145_000,
    type: 'expense',
    categoryId: 'cat-food',
    accountId: 'acct-1',
    recurringId: 'rec-1',
  };

  it('keeps the id and fields the form does not show', () => {
    const edited = build({ amount: '1450.00', description: 'Rent' }, existing);
    expect(edited.id).toBe('t-9');
    expect(edited.recurringId).toBe('rec-1');
    expect(edited.amountCents).toBe(145_000);
  });

  it('drops transfer-only fields when a transfer becomes an expense', () => {
    const transfer: Transaction = {
      id: 't-8',
      date: '2026-10-01',
      description: 'Save',
      amountCents: 5_000,
      type: 'transfer',
      categoryId: null,
      accountId: 'acct-1',
      toAccountId: 'acct-2',
      goalId: 'goal-1',
    };
    const edited = build({ type: 'expense', categoryId: 'cat-food' }, transfer);
    expect(edited.toAccountId).toBeUndefined();
    expect(edited.goalId).toBeUndefined();
  });

  it('removes an optional field the user cleared', () => {
    const withMerchant: Transaction = { ...existing, merchant: 'Cityview' };
    expect(build({ merchant: '' }, withMerchant).merchant).toBeUndefined();
  });
});

describe('form values', () => {
  it('starts with an empty expense dated today', () => {
    expect(emptyFormValues('2026-10-20', 'acct-1')).toMatchObject({
      type: 'expense',
      date: '2026-10-20',
      description: '',
      amount: '',
      accountId: 'acct-1',
    });
  });

  it('turns a transaction into editable text', () => {
    const transaction: Transaction = {
      id: 't',
      date: '2026-10-02',
      description: 'Lunch',
      amountCents: 1_250,
      type: 'transfer',
      categoryId: null,
      accountId: 'acct-1',
      toAccountId: 'acct-2',
    };
    expect(valuesFromTransaction(transaction)).toMatchObject({
      amount: '12.50',
      categoryId: '',
      toAccountId: 'acct-2',
      goalId: '',
      merchant: '',
    });
  });
});