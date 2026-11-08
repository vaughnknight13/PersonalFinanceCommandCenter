import { describe, expect, it } from 'vitest';
import { makeValidData } from '../../test/fixtures';
import type { Transaction } from '../../types/finance';
import { addTransaction, removeTransaction, replaceTransaction } from './mutations';

const newTransaction: Transaction = {
  id: 't-new',
  date: '2026-10-09',
  description: 'Bookstore',
  amountCents: 2_400,
  type: 'expense',
  categoryId: 'cat-food',
  accountId: 'acct-1',
};

describe('transaction mutations', () => {
  it('adds a transaction without changing the original data', () => {
    const data = makeValidData();
    const result = addTransaction(data, newTransaction);

    expect(result.transactions).toHaveLength(4);
    expect(result.transactions.at(-1)).toEqual(newTransaction);
    expect(data.transactions).toHaveLength(3);
  });

  it('replaces only the transaction with the matching id', () => {
    const data = makeValidData();
    const edited: Transaction = { id: 't-2', date: '2026-10-02', description: 'Late lunch', amountCents: 1_800, type: 'expense', categoryId: 'cat-food', accountId: 'acct-1' };
    const result = replaceTransaction(data, edited);

    expect(result.transactions.map((transaction) => transaction.description)).toEqual([
      'Paycheck',
      'Late lunch',
      'Move to savings',
    ]);
    expect(data.transactions[1]?.description).toBe('Lunch');
  });

  it('leaves the data alone when the id to replace does not exist', () => {
    const data = makeValidData();
    expect(replaceTransaction(data, newTransaction).transactions).toEqual(data.transactions);
  });

  it('removes a transaction by id', () => {
    const data = makeValidData();
    const result = removeTransaction(data, 't-2');

    expect(result.transactions.map((transaction) => transaction.id)).toEqual(['t-1', 't-3']);
    expect(data.transactions).toHaveLength(3);
  });

  it('leaves the data alone when the id to remove does not exist', () => {
    const data = makeValidData();
    expect(removeTransaction(data, 'nope').transactions).toEqual(data.transactions);
  });

  it('does not touch anything except transactions', () => {
    const data = makeValidData();
    const result = removeTransaction(addTransaction(data, newTransaction), 't-1');
    expect(result.accounts).toBe(data.accounts);
    expect(result.categories).toBe(data.categories);
    expect(result.budgets).toBe(data.budgets);
  });
});