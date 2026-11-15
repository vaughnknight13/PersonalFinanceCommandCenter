import { describe, expect, it } from 'vitest';
import { makeValidData } from '../../test/fixtures';
import type { Account } from '../../types/finance';
import {
  accountFormFromAccount,
  accountUsageById,
  addAccount,
  deleteAccountProblem,
  emptyAccountForm,
  removeAccount,
  replaceAccount,
  validateAccountForm,
  type AccountFormErrors,
  type AccountFormValues,
} from './accountLogic';

const existing: Account[] = [
  { id: 'a1', name: 'Checking', kind: 'checking', openingBalanceCents: 0 },
  { id: 'a2', name: 'Savings', kind: 'savings', openingBalanceCents: 0 },
];

function values(overrides: Partial<AccountFormValues> = {}): AccountFormValues {
  return { name: 'Travel Card', kind: 'credit', openingBalance: '-250.00', ...overrides };
}

function errorsOf(overrides: Partial<AccountFormValues> = {}, id = 'new'): AccountFormErrors {
  const result = validateAccountForm(values(overrides), id, existing);
  return result.ok ? {} : result.errors;
}

describe('validateAccountForm', () => {
  it('builds an account, allowing a negative opening balance', () => {
    expect(validateAccountForm(values(), 'new', existing)).toEqual({
      ok: true,
      account: { id: 'new', name: 'Travel Card', kind: 'credit', openingBalanceCents: -25_000 },
    });
  });

  it('trims the name and treats a blank balance as zero', () => {
    const result = validateAccountForm(values({ name: '  Cash  ', kind: 'cash', openingBalance: '  ' }), 'new', existing);
    expect(result).toEqual({
      ok: true,
      account: { id: 'new', name: 'Cash', kind: 'cash', openingBalanceCents: 0 },
    });
  });

  it('requires a name of reasonable length', () => {
    expect(errorsOf({ name: '' }).name).toBe('Enter an account name.');
    expect(errorsOf({ name: '   ' }).name).toBe('Enter an account name.');
    expect(errorsOf({ name: 'x'.repeat(61) }).name).toBe('Keep this to 60 characters or fewer.');
  });

  it('rejects an unknown account type', () => {
    expect(errorsOf({ kind: 'crypto' }).kind).toBeDefined();
  });

  it.each(['abc', '12.345', '1e3'])('rejects the opening balance "%s"', (openingBalance) => {
    expect(errorsOf({ openingBalance }).openingBalance).toContain('Enter a valid amount');
  });

  it('rejects a duplicate name, ignoring capitals', () => {
    expect(errorsOf({ name: 'checking' }).name).toBe('You already have an account with this name.');
  });

  it('allows an account to keep its own name when edited', () => {
    const result = validateAccountForm(values({ name: 'Checking', kind: 'checking', openingBalance: '0' }), 'a1', existing);
    expect(result.ok).toBe(true);
  });

  it('reports every problem at once', () => {
    const errors = errorsOf({ name: '', openingBalance: 'abc' });
    expect(errors.name).toBeDefined();
    expect(errors.openingBalance).toBeDefined();
  });
});

describe('account form values', () => {
  it('starts with an empty checking account', () => {
    expect(emptyAccountForm()).toEqual({ name: '', kind: 'checking', openingBalance: '0.00' });
  });

  it('turns an account into editable text', () => {
    const card: Account = { id: 'c', name: 'Card', kind: 'credit', openingBalanceCents: -25_000 };
    expect(accountFormFromAccount(card)).toEqual({ name: 'Card', kind: 'credit', openingBalance: '-250.00' });
  });
});

describe('accountUsageById', () => {
  it('counts transactions as source or destination, and recurring items', () => {
    const usage = accountUsageById(makeValidData());
    expect(usage.get('acct-1')).toEqual({ transactionCount: 3, recurringCount: 1 });
    expect(usage.get('acct-2')).toEqual({ transactionCount: 1, recurringCount: 0 });
  });
});

describe('deleteAccountProblem', () => {
  it('blocks deleting an account that transactions use, as source or destination', () => {
    expect(deleteAccountProblem(makeValidData(), 'acct-1')).toContain('used by 3 transactions');
    expect(deleteAccountProblem(makeValidData(), 'acct-2')).toContain('used by 1 transaction.');
  });

  it('blocks deleting an account that only a recurring item uses', () => {
    const data = { ...makeValidData(), transactions: [] };
    expect(deleteAccountProblem(data, 'acct-1')).toContain('used by 1 recurring item');
  });

  it('allows deleting an unused account', () => {
    const data = { ...makeValidData(), transactions: [], recurringItems: [] };
    expect(deleteAccountProblem(data, 'acct-2')).toBeNull();
  });

  it('never allows deleting the last account', () => {
    const [first] = makeValidData().accounts;
    if (first === undefined) {
      throw new Error('fixture should contain an account');
    }
    const data = { ...makeValidData(), accounts: [first], transactions: [], recurringItems: [] };
    expect(deleteAccountProblem(data, first.id)).toBe('You need at least one account.');
  });
});

describe('account changes', () => {
  const newAccount: Account = { id: 'a3', name: 'Cash', kind: 'cash', openingBalanceCents: 500 };

  it('adds, replaces and removes without changing the original data', () => {
    const data = makeValidData();

    expect(addAccount(data, newAccount).accounts.map((account) => account.id)).toEqual(['acct-1', 'acct-2', 'a3']);

    const renamed = replaceAccount(data, { id: 'acct-2', name: 'Rainy Day', kind: 'savings', openingBalanceCents: 0 });
    expect(renamed.accounts.map((account) => account.name)).toEqual(['Checking', 'Rainy Day']);

    expect(removeAccount(data, 'acct-2').accounts.map((account) => account.id)).toEqual(['acct-1']);
    expect(data.accounts).toHaveLength(2);
    expect(data.accounts[1]?.name).toBe('Savings');
  });

  it('leaves everything except accounts alone', () => {
    const data = makeValidData();
    const result = addAccount(data, newAccount);
    expect(result.transactions).toBe(data.transactions);
    expect(result.categories).toBe(data.categories);
  });
});