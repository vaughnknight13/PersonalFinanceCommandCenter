import type { AppData } from '../types/finance';

// A small, valid dataset that other tests copy and then break on purpose.
export function makeValidData(): AppData {
  return {
    isDemo: false,
    accounts: [
      { id: 'acct-1', name: 'Checking', kind: 'checking', openingBalanceCents: 100_000 },
      { id: 'acct-2', name: 'Savings', kind: 'savings', openingBalanceCents: 0 },
    ],
    categories: [
      { id: 'cat-food', name: 'Food', kind: 'expense' },
      { id: 'cat-pay', name: 'Pay', kind: 'income' },
    ],
    transactions: [
      { id: 't-1', date: '2026-10-01', description: 'Paycheck', amountCents: 200_000, type: 'income', categoryId: 'cat-pay', accountId: 'acct-1' },
      { id: 't-2', date: '2026-10-02', description: 'Lunch', amountCents: 1_250, type: 'expense', categoryId: 'cat-food', accountId: 'acct-1' },
      { id: 't-3', date: '2026-10-03', description: 'Move to savings', amountCents: 50_000, type: 'transfer', categoryId: null, accountId: 'acct-1', toAccountId: 'acct-2', goalId: 'goal-1' },
    ],
    budgets: [{ categoryId: 'cat-food', monthlyLimitCents: 40_000 }],
    recurringItems: [
      { id: 'rec-1', description: 'Paycheck', amountCents: 200_000, type: 'income', categoryId: 'cat-pay', accountId: 'acct-1', frequency: 'biweekly', startDate: '2026-10-01', active: true },
    ],
    savingsGoals: [
      { id: 'goal-1', name: 'Emergency fund', targetCents: 500_000, initialSavedCents: 0, targetDate: '2027-06-01' },
    ],
  };
}