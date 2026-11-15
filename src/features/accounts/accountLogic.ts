import { accountSchema, type Account, type AppData } from '../../types/finance';
import { centsToInputString, parseMoneyToCents } from '../../utils/money';
import { pluralize } from '../../utils/plural';

export const ACCOUNT_KINDS: readonly Account['kind'][] = ['checking', 'savings', 'credit', 'cash'];

export const ACCOUNT_KIND_LABELS: Record<Account['kind'], string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit card',
  cash: 'Cash',
};

// Everything the form holds is text, exactly as typed or chosen.
export interface AccountFormValues {
  name: string;
  kind: string;
  openingBalance: string;
}

export type AccountFormField = keyof AccountFormValues;
export type AccountFormErrors = Partial<Record<AccountFormField, string>>;
export type AccountFormResult = { ok: true; account: Account } | { ok: false; errors: AccountFormErrors };

export const ACCOUNT_FIELD_ORDER: readonly AccountFormField[] = ['name', 'kind', 'openingBalance'];

const FIELD_BY_SCHEMA_PATH: Record<string, AccountFormField | undefined> = {
  name: 'name',
  kind: 'kind',
  openingBalanceCents: 'openingBalance',
};

export function emptyAccountForm(): AccountFormValues {
  return { name: '', kind: 'checking', openingBalance: '0.00' };
}

export function accountFormFromAccount(account: Account): AccountFormValues {
  return {
    name: account.name,
    kind: account.kind,
    openingBalance: centsToInputString(account.openingBalanceCents),
  };
}

// An account name must be unique (ignoring capitals) so two accounts can
// never be confused in a dropdown. A blank opening balance means zero.
export function validateAccountForm(
  values: AccountFormValues,
  id: string,
  existingAccounts: readonly Account[],
): AccountFormResult {
  const errors: AccountFormErrors = {};

  let openingBalanceCents = 0;
  const balanceText = values.openingBalance.trim() === '' ? '0' : values.openingBalance;
  const balance = parseMoneyToCents(balanceText);
  if (balance.ok) {
    openingBalanceCents = balance.cents; // may be negative: a credit card balance
  } else {
    errors.openingBalance = balance.error;
  }

  const parsed = accountSchema.safeParse({ id, name: values.name, kind: values.kind, openingBalanceCents });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = FIELD_BY_SCHEMA_PATH[String(issue.path[0])];
      if (field !== undefined && errors[field] === undefined) {
        errors[field] = issue.message;
      }
    }
  }

  const wantedName = values.name.trim().toLowerCase();
  const isDuplicate = existingAccounts.some(
    (account) => account.id !== id && account.name.trim().toLowerCase() === wantedName,
  );
  if (errors.name === undefined && isDuplicate) {
    errors.name = 'You already have an account with this name.';
  }

  if (parsed.success && Object.keys(errors).length === 0) {
    return { ok: true, account: parsed.data };
  }
  return { ok: false, errors };
}

export interface AccountUsage {
  transactionCount: number; // as the source OR the destination of a transfer
  recurringCount: number;
}

const NO_USAGE: AccountUsage = { transactionCount: 0, recurringCount: 0 };

// One pass over the data, so the accounts table needs no repeated searches.
export function accountUsageById(data: AppData): Map<string, AccountUsage> {
  const usage = new Map<string, AccountUsage>();

  function entryFor(accountId: string): AccountUsage {
    let entry = usage.get(accountId);
    if (entry === undefined) {
      entry = { transactionCount: 0, recurringCount: 0 };
      usage.set(accountId, entry);
    }
    return entry;
  }

  for (const transaction of data.transactions) {
    entryFor(transaction.accountId).transactionCount += 1;
    if (transaction.toAccountId !== undefined) {
      entryFor(transaction.toAccountId).transactionCount += 1;
    }
  }
  for (const item of data.recurringItems) {
    entryFor(item.accountId).recurringCount += 1;
    if (item.toAccountId !== undefined) {
      entryFor(item.toAccountId).recurringCount += 1;
    }
  }
  return usage;
}

// null means the account can be deleted. Otherwise the text says why not.
// An account that records refer to cannot go: those records would point at
// nothing, and the data would no longer pass validation.
export function deleteAccountProblem(data: AppData, accountId: string): string | null {
  if (data.accounts.length <= 1) {
    return 'You need at least one account.';
  }
  const usage = accountUsageById(data).get(accountId) ?? NO_USAGE;
  if (usage.transactionCount > 0) {
    return `This account is used by ${pluralize(usage.transactionCount, 'transaction')}. Delete or change those first.`;
  }
  if (usage.recurringCount > 0) {
    return `This account is used by ${pluralize(usage.recurringCount, 'recurring item')}. Remove those first.`;
  }
  return null;
}

// Pure changes: each returns new data and never modifies the old.
export function addAccount(data: AppData, account: Account): AppData {
  return { ...data, accounts: [...data.accounts, account] };
}

export function replaceAccount(data: AppData, account: Account): AppData {
  return { ...data, accounts: data.accounts.map((existing) => (existing.id === account.id ? account : existing)) };
}

export function removeAccount(data: AppData, accountId: string): AppData {
  return { ...data, accounts: data.accounts.filter((existing) => existing.id !== accountId) };
}