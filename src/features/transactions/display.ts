import type { Transaction } from '../../types/finance';
import { formatCents } from '../../utils/money';

export function transactionTypeLabel(type: Transaction['type']): string {
  switch (type) {
    case 'income':
      return 'Income';
    case 'expense':
      return 'Expense';
    case 'transfer':
      return 'Transfer';
  }
}

// Income shows "+", expenses show "-", and transfers show no sign because
// they are neither. The sign and the Type column mean color is never the
// only thing telling them apart.
export function formatTransactionAmount(transaction: Transaction): string {
  switch (transaction.type) {
    case 'income':
      return `+${formatCents(transaction.amountCents)}`;
    case 'expense':
      return formatCents(-transaction.amountCents);
    case 'transfer':
      return formatCents(transaction.amountCents);
  }
}

// "Checking" for income and expenses, "Checking → Savings" for transfers.
export function describeAccounts(
  transaction: Transaction,
  accountNames: ReadonlyMap<string, string>,
): string {
  const from = accountNames.get(transaction.accountId) ?? 'Unknown account';
  if (transaction.type !== 'transfer' || transaction.toAccountId === undefined) {
    return from;
  }
  const to = accountNames.get(transaction.toAccountId) ?? 'Unknown account';
  return `${from} → ${to}`;
}

export function describeCategory(
  transaction: Transaction,
  categoryNames: ReadonlyMap<string, string>,
): string {
  if (transaction.categoryId === null) {
    return 'None';
  }
  return categoryNames.get(transaction.categoryId) ?? 'Unknown category';
}