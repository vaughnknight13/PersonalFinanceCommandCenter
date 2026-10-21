import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../../types/finance';
import { calculateAccountBalances, summarizePeriod, totalBalanceCents } from './calculations';

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

const october = { start: '2026-10-01', end: '2026-10-31' };

describe('summarizePeriod', () => {
  const transactions: Transaction[] = [
    tx({ id: 'i1', date: '2026-10-01', type: 'income', categoryId: 'cat-pay', amountCents: 200_000 }), // first day
    tx({ id: 'i2', date: '2026-10-31', type: 'income', categoryId: 'cat-interest', amountCents: 5_000, accountId: 'acct-2' }), // last day
    tx({ id: 'e1', date: '2026-10-05', amountCents: 20_000 }),
    tx({ id: 'e2', date: '2026-10-01', amountCents: 1_500 }),
    tx({ id: 't1', date: '2026-10-03', type: 'transfer', categoryId: null, amountCents: 30_000, toAccountId: 'acct-2', goalId: 'goal-1' }),
    tx({ id: 't2', date: '2026-10-04', type: 'transfer', categoryId: null, amountCents: 10_000, accountId: 'acct-2', toAccountId: 'acct-1' }),
    tx({ id: 'out1', date: '2026-09-30', amountCents: 50_000 }), // day before
    tx({ id: 'out2', date: '2026-11-01', type: 'income', categoryId: 'cat-pay', amountCents: 70_000 }), // day after
  ];

  it('totals income, expenses and net for the period', () => {
    const summary = summarizePeriod(transactions, october);
    expect(summary.incomeCents).toBe(205_000);
    expect(summary.expenseCents).toBe(21_500);
    expect(summary.netCents).toBe(183_500);
  });

  it('keeps transfers out of income, expenses and net', () => {
    const summary = summarizePeriod(transactions, october);
    expect(summary.transfersCents).toBe(40_000);
    expect(summary.savingsContributionsCents).toBe(30_000);
    expect(summary.incomeCents + summary.expenseCents + summary.transfersCents).toBe(266_500);
  });

  it('counts only transactions inside the range, boundaries included', () => {
    expect(summarizePeriod(transactions, october).transactionCount).toBe(6);
  });

  it('reports zeros for an empty dataset', () => {
    expect(summarizePeriod([], october)).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
      transfersCents: 0,
      savingsContributionsCents: 0,
      transactionCount: 0,
    });
  });

  it('shows no income, spending or net for a period that only has transfers', () => {
    const onlyTransfers = [tx({ id: 't', type: 'transfer', categoryId: null, amountCents: 5_000, toAccountId: 'acct-2' })];
    const summary = summarizePeriod(onlyTransfers, october);
    expect(summary).toMatchObject({ incomeCents: 0, expenseCents: 0, netCents: 0, transfersCents: 5_000 });
  });

  it('adds many small amounts exactly', () => {
    const tenDimes = Array.from({ length: 10 }, (_, index) => tx({ id: `d${index}`, amountCents: 10 }));
    expect(summarizePeriod(tenDimes, october).expenseCents).toBe(100);
  });

  it('gives a negative net when spending exceeds income', () => {
    const overspent = [
      tx({ id: 'i', type: 'income', categoryId: 'cat-pay', amountCents: 10_000 }),
      tx({ id: 'e', amountCents: 25_000 }),
    ];
    expect(summarizePeriod(overspent, october).netCents).toBe(-15_000);
  });
});

describe('calculateAccountBalances', () => {
  const accounts: Account[] = [
    { id: 'acct-1', name: 'Checking', kind: 'checking', openingBalanceCents: 100_000 },
    { id: 'acct-2', name: 'Savings', kind: 'savings', openingBalanceCents: 50_000 },
    { id: 'acct-3', name: 'Card', kind: 'credit', openingBalanceCents: -20_000 },
  ];

  const transactions: Transaction[] = [
    tx({ id: '1', date: '2026-10-01', type: 'income', categoryId: 'cat-pay', amountCents: 200_000 }),
    tx({ id: '2', date: '2026-10-02', amountCents: 30_000 }),
    tx({ id: '3', date: '2026-10-03', type: 'transfer', categoryId: null, amountCents: 40_000, toAccountId: 'acct-2' }),
    tx({ id: '4', date: '2026-10-04', amountCents: 15_000, accountId: 'acct-3' }), // card spending adds debt
    tx({ id: '5', date: '2026-10-05', type: 'transfer', categoryId: null, amountCents: 25_000, toAccountId: 'acct-3' }), // card payment
  ];

  function balanceOf(accountId: string, asOf: string, extra: Transaction[] = []): number {
    const balances = calculateAccountBalances(accounts, [...transactions, ...extra], asOf);
    return balances.find((balance) => balance.accountId === accountId)?.balanceCents ?? Number.NaN;
  }

  it('applies income, expenses and transfers to the right accounts', () => {
    expect(balanceOf('acct-1', '2026-10-31')).toBe(205_000); // 100k + 200k - 30k - 40k - 25k
    expect(balanceOf('acct-2', '2026-10-31')).toBe(90_000);
    expect(balanceOf('acct-3', '2026-10-31')).toBe(-10_000); // -20k - 15k + 25k
  });

  it('does not change the total when money is transferred', () => {
    const balances = calculateAccountBalances(accounts, transactions, '2026-10-31');
    const openingTotal = 100_000 + 50_000 - 20_000;
    const incomeTotal = 200_000;
    const expenseTotal = 30_000 + 15_000;
    expect(totalBalanceCents(balances)).toBe(openingTotal + incomeTotal - expenseTotal);
  });

  it('ignores transactions after the as-of date and includes the as-of date itself', () => {
    const future = tx({ id: 'f', date: '2026-12-01', amountCents: 10_000 });
    expect(balanceOf('acct-1', '2026-10-31', [future])).toBe(205_000);
    expect(balanceOf('acct-1', '2026-12-01', [future])).toBe(195_000);
  });

  it('returns the opening balances when there are no transactions', () => {
    const balances = calculateAccountBalances(accounts, [], '2026-10-31');
    expect(balances.map((balance) => balance.balanceCents)).toEqual([100_000, 50_000, -20_000]);
  });

  it('keeps account order, names and kinds', () => {
    const balances = calculateAccountBalances(accounts, transactions, '2026-10-31');
    expect(balances.map((balance) => `${balance.name}:${balance.kind}`)).toEqual([
      'Checking:checking',
      'Savings:savings',
      'Card:credit',
    ]);
  });

  it('ignores transactions for accounts that do not exist', () => {
    const ghost = tx({ id: 'g', accountId: 'ghost', amountCents: 99_999 });
    expect(balanceOf('acct-1', '2026-10-31', [ghost])).toBe(205_000);
  });
});