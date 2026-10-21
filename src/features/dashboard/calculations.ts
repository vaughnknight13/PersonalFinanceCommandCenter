import type { Account, Transaction } from '../../types/finance';
import type { Cents, IsoDate } from '../../types/primitives';
import { isDateInRange, type DateRange } from '../../utils/dates';

export interface PeriodSummary {
  incomeCents: Cents;
  expenseCents: Cents;
  netCents: Cents; // income minus expenses
  transfersCents: Cents; // money moved between accounts: not income, not spending
  savingsContributionsCents: Cents; // the part of transfersCents that funds a goal
  transactionCount: number;
}

// One pass over the transactions: O(n). Income and expenses are the only
// things that change net cash flow. Transfers are tallied separately and
// never touch income, expenses or net, which is how "moving $300 to savings"
// avoids being counted as spending.
export function summarizePeriod(transactions: readonly Transaction[], range: DateRange): PeriodSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let transfersCents = 0;
  let savingsContributionsCents = 0;
  let transactionCount = 0;

  for (const transaction of transactions) {
    if (!isDateInRange(transaction.date, range.start, range.end)) {
      continue;
    }
    transactionCount += 1;

    switch (transaction.type) {
      case 'income':
        incomeCents += transaction.amountCents;
        break;
      case 'expense':
        expenseCents += transaction.amountCents;
        break;
      case 'transfer':
        transfersCents += transaction.amountCents;
        if (transaction.goalId !== undefined) {
          savingsContributionsCents += transaction.amountCents;
        }
        break;
    }
  }

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    transfersCents,
    savingsContributionsCents,
    transactionCount,
  };
}

export interface AccountBalance {
  accountId: string;
  name: string;
  kind: Account['kind'];
  balanceCents: Cents;
}

function addToBalance(balances: Map<string, Cents>, accountId: string, change: Cents): void {
  const current = balances.get(accountId);
  if (current !== undefined) {
    balances.set(accountId, current + change);
  }
}

// Balance = opening balance + income - expenses - transfers out + transfers in,
// counting only transactions dated on or before `asOf` (so scheduled or
// future-dated entries do not change today's balance). This is a calculated
// estimate from recorded data, not a balance reported by a bank.
export function calculateAccountBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  asOf: IsoDate,
): AccountBalance[] {
  const balances = new Map<string, Cents>(accounts.map((account) => [account.id, account.openingBalanceCents]));

  for (const transaction of transactions) {
    if (transaction.date > asOf) {
      continue;
    }
    switch (transaction.type) {
      case 'income':
        addToBalance(balances, transaction.accountId, transaction.amountCents);
        break;
      case 'expense':
        addToBalance(balances, transaction.accountId, -transaction.amountCents);
        break;
      case 'transfer':
        addToBalance(balances, transaction.accountId, -transaction.amountCents);
        if (transaction.toAccountId !== undefined) {
          addToBalance(balances, transaction.toAccountId, transaction.amountCents);
        }
        break;
    }
  }

  return accounts.map((account) => ({
    accountId: account.id,
    name: account.name,
    kind: account.kind,
    balanceCents: balances.get(account.id) ?? account.openingBalanceCents,
  }));
}

export function totalBalanceCents(balances: readonly AccountBalance[]): Cents {
  return balances.reduce((total, balance) => total + balance.balanceCents, 0);
}