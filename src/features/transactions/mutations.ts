import type { AppData, Transaction } from '../../types/finance';

// Each function returns a NEW AppData and never changes the one it is given.
// React and the tests both rely on that.

export function addTransaction(data: AppData, transaction: Transaction): AppData {
  return { ...data, transactions: [...data.transactions, transaction] };
}

export function replaceTransaction(data: AppData, transaction: Transaction): AppData {
  return {
    ...data,
    transactions: data.transactions.map((existing) => (existing.id === transaction.id ? transaction : existing)),
  };
}

export function removeTransaction(data: AppData, transactionId: string): AppData {
  return { ...data, transactions: data.transactions.filter((existing) => existing.id !== transactionId) };
}