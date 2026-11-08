import { transactionSchema, movementRuleIssues, type Transaction } from '../../types/finance';
import type { IsoDate } from '../../types/primitives';
import { centsToInputString, parseMoneyToCents } from '../../utils/money';

// Everything the form holds is text, exactly as typed or chosen.
export interface TransactionFormValues {
  type: Transaction['type'];
  date: string;
  description: string;
  amount: string;
  categoryId: string; // '' means "not chosen"
  accountId: string;
  toAccountId: string;
  goalId: string;
  merchant: string;
  notes: string;
}

export type FormField = keyof TransactionFormValues;
export type FormErrors = Partial<Record<FormField, string>>;

export type FormResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; errors: FormErrors; generalError: string };

// The order fields appear on screen, used to focus the first problem.
export const FORM_FIELD_ORDER: readonly FormField[] = [
  'date',
  'description',
  'amount',
  'categoryId',
  'accountId',
  'toAccountId',
  'goalId',
  'merchant',
  'notes',
];

// The schema calls the amount "amountCents"; the form calls it "amount".
const FIELD_BY_SCHEMA_PATH: Record<string, FormField | undefined> = {
  type: 'type',
  date: 'date',
  description: 'description',
  amountCents: 'amount',
  categoryId: 'categoryId',
  accountId: 'accountId',
  toAccountId: 'toAccountId',
  goalId: 'goalId',
  merchant: 'merchant',
  notes: 'notes',
};

export function emptyFormValues(today: IsoDate, defaultAccountId: string): TransactionFormValues {
  return {
    type: 'expense',
    date: today,
    description: '',
    amount: '',
    categoryId: '',
    accountId: defaultAccountId,
    toAccountId: '',
    goalId: '',
    merchant: '',
    notes: '',
  };
}

export function valuesFromTransaction(transaction: Transaction): TransactionFormValues {
  return {
    type: transaction.type,
    date: transaction.date,
    description: transaction.description,
    amount: centsToInputString(transaction.amountCents),
    categoryId: transaction.categoryId ?? '',
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId ?? '',
    goalId: transaction.goalId ?? '',
    merchant: transaction.merchant ?? '',
    notes: transaction.notes ?? '',
  };
}

function emptyToUndefined(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

// Checks the form and builds a Transaction. `existing` is the transaction
// being edited (if any): fields the form does not show, such as the link to
// a recurring item, are kept from it.
export function validateTransactionForm(
  values: TransactionFormValues,
  id: string,
  existing: Transaction | undefined,
): FormResult {
  const errors: FormErrors = {};
  const isTransfer = values.type === 'transfer';

  // Amount: parse the text first so the message is about what the user typed.
  let amountCents = 0;
  const amount = parseMoneyToCents(values.amount);
  if (!amount.ok) {
    errors.amount = amount.error;
  } else if (amount.cents < 0) {
    errors.amount = 'Enter the amount without a minus sign. Choose Income, Expense or Transfer above instead.';
  } else {
    amountCents = amount.cents; // zero is rejected by the schema below
  }

  if (values.accountId === '') {
    errors.accountId = 'Choose an account.';
  }

  const candidate = {
    ...existing,
    id,
    date: values.date,
    description: values.description,
    amountCents,
    type: values.type,
    categoryId: isTransfer ? null : emptyToUndefined(values.categoryId) ?? null,
    accountId: values.accountId,
    toAccountId: isTransfer ? emptyToUndefined(values.toAccountId) : undefined,
    goalId: isTransfer ? emptyToUndefined(values.goalId) : undefined,
    merchant: emptyToUndefined(values.merchant),
    notes: emptyToUndefined(values.notes),
  };

  const parsed = transactionSchema.safeParse(candidate);
  const generalProblems: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = FIELD_BY_SCHEMA_PATH[String(issue.path[0])];
      if (field === undefined) {
        generalProblems.push(issue.message);
      } else if (errors[field] === undefined) {
        errors[field] = issue.message; // the first message for a field wins
      }
    }
  }

  // The schema only checks combinations (such as "a transfer needs a
  // destination") after every single field is valid. Running the same rules
  // here shows all the problems at once instead of in two rounds.
  for (const issue of movementRuleIssues({
    type: values.type,
    categoryId: candidate.categoryId,
    accountId: values.accountId,
    toAccountId: candidate.toAccountId,
    goalId: candidate.goalId,
  })) {
    const field = FIELD_BY_SCHEMA_PATH[issue.path];
    if (field !== undefined && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }

  if (parsed.success && Object.keys(errors).length === 0) {
    return { ok: true, transaction: parsed.data };
  }
  return { ok: false, errors, generalError: generalProblems.join(' ') };
}