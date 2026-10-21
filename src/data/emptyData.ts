import type { AppData } from '../types/finance';
import { DEFAULT_CATEGORIES } from './defaultCategories';

// What "start fresh" gives the user: default categories and one empty account.
export function createEmptyData(): AppData {
  return {
    isDemo: false,
    accounts: [{ id: 'acct-checking', name: 'Checking', kind: 'checking', openingBalanceCents: 0 }],
    categories: [...DEFAULT_CATEGORIES],
    transactions: [],
    budgets: [],
    recurringItems: [],
    savingsGoals: [],
  };
}