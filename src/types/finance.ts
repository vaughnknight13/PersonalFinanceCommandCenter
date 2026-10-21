import { z } from 'zod';
import { isValidIsoDate } from '../utils/dates';
import { MAX_CENTS } from '../utils/money';

// Each schema below is the single source of truth: the TypeScript type is
// derived from it with z.infer, so the type and the validation rules can
// never disagree.

const idSchema = z.string().min(1, 'An id is required.').max(100);

const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, 'Enter a valid date (YYYY-MM-DD).');

// Transaction amounts are stored as positive magnitudes; `type` gives the direction.
const positiveCentsSchema = z
  .number()
  .int('Amount must be a whole number of cents.')
  .positive('Amount must be greater than zero.')
  .max(MAX_CENTS, 'That amount is too large.');

const nonNegativeCentsSchema = z
  .number()
  .int('Amount must be a whole number of cents.')
  .min(0, 'Amount cannot be negative.')
  .max(MAX_CENTS, 'That amount is too large.');

// Account opening balances may be negative (for example, a credit card).
const signedCentsSchema = z
  .number()
  .int('Amount must be a whole number of cents.')
  .min(-MAX_CENTS, 'That amount is too large.')
  .max(MAX_CENTS, 'That amount is too large.');

function requiredText(maxLength: number, message: string) {
  return z.string().trim().min(1, message).max(maxLength);
}

// ---- Money movement rules shared by transactions and recurring items ----

export const movementTypeSchema = z.enum(['income', 'expense', 'transfer']);

interface MoneyMovementShape {
  type: 'income' | 'expense' | 'transfer';
  categoryId: string | null;
  accountId: string;
  toAccountId?: string | undefined;
  goalId?: string | undefined;
}

interface RuleIssue {
  path: string;
  message: string;
}

// Transfers move money between two of the user's accounts: they have a
// destination account and no category. Income and expenses are the opposite.
// Keeping this as a plain function makes the rules easy to read and test.
export function movementRuleIssues(value: MoneyMovementShape): RuleIssue[] {
  const issues: RuleIssue[] = [];

  if (value.type === 'transfer') {
    if (value.toAccountId === undefined) {
      issues.push({ path: 'toAccountId', message: 'Choose the account the money goes to.' });
    } else if (value.toAccountId === value.accountId) {
      issues.push({ path: 'toAccountId', message: 'A transfer needs two different accounts.' });
    }
    if (value.categoryId !== null) {
      issues.push({ path: 'categoryId', message: 'Transfers do not have a category.' });
    }
  } else {
    if (value.toAccountId !== undefined) {
      issues.push({ path: 'toAccountId', message: 'Only transfers have a destination account.' });
    }
    if (value.categoryId === null) {
      issues.push({ path: 'categoryId', message: 'Choose a category.' });
    }
    if (value.goalId !== undefined) {
      issues.push({ path: 'goalId', message: 'Only transfers can fund a savings goal.' });
    }
  }

  return issues;
}

// ---- Entities ----

export const accountSchema = z.object({
  id: idSchema,
  name: requiredText(60, 'Enter an account name.'),
  kind: z.enum(['checking', 'savings', 'credit', 'cash']),
  openingBalanceCents: signedCentsSchema,
});

export const categorySchema = z.object({
  id: idSchema,
  name: requiredText(60, 'Enter a category name.'),
  kind: z.enum(['income', 'expense']),
});

export const transactionSchema = z
  .object({
    id: idSchema,
    date: isoDateSchema,
    description: requiredText(200, 'Enter a description.'),
    amountCents: positiveCentsSchema,
    type: movementTypeSchema,
    categoryId: idSchema.nullable(),
    accountId: idSchema,
    toAccountId: idSchema.optional(),
    goalId: idSchema.optional(),
    recurringId: idSchema.optional(),
    merchant: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    for (const issue of movementRuleIssues(value)) {
      ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    }
  });

export const budgetSchema = z.object({
  categoryId: idSchema,
  monthlyLimitCents: positiveCentsSchema,
});

export const recurringItemSchema = z
  .object({
    id: idSchema,
    description: requiredText(200, 'Enter a description.'),
    amountCents: positiveCentsSchema,
    type: movementTypeSchema,
    categoryId: idSchema.nullable(),
    accountId: idSchema,
    toAccountId: idSchema.optional(),
    goalId: idSchema.optional(),
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional(),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    for (const issue of movementRuleIssues(value)) {
      ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    }
    if (value.endDate !== undefined && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'The end date cannot be before the start date.',
      });
    }
  });

// The "current saved amount" of a goal is NOT stored. It is calculated as
// initialSavedCents plus every transfer linked to the goal (see goalId on
// transactions). That way a contribution can never be counted twice.
export const savingsGoalSchema = z.object({
  id: idSchema,
  name: requiredText(80, 'Enter a goal name.'),
  targetCents: positiveCentsSchema,
  initialSavedCents: nonNegativeCentsSchema,
  targetDate: isoDateSchema,
  notes: z.string().trim().max(1000).optional(),
});

// isDemo is true only while the data came from the built-in demo dataset.
// It changes only when the user loads demo data, starts fresh, or restores a backup.
export const appDataSchema = z.object({
  isDemo: z.boolean(),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  recurringItems: z.array(recurringItemSchema),
  savingsGoals: z.array(savingsGoalSchema),
});

export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type RecurringItem = z.infer<typeof recurringItemSchema>;
export type SavingsGoal = z.infer<typeof savingsGoalSchema>;
export type AppData = z.infer<typeof appDataSchema>;