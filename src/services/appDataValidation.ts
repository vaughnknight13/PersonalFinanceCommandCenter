import { appDataSchema, type AppData, type Category } from '../types/finance';

export type AppDataResult =
  | { ok: true; data: AppData }
  | { ok: false; errors: string[] };

const MAX_REPORTED_ERRORS = 20;

interface Lookups {
  accountIds: Set<string>;
  categoriesById: Map<string, Category>;
  goalIds: Set<string>;
}

interface MoneyMovement {
  type: 'income' | 'expense' | 'transfer';
  categoryId: string | null;
  accountId: string;
  toAccountId?: string | undefined;
  goalId?: string | undefined;
}

// Checks the shape of every record (Zod), then checks that records refer to
// things that exist (below). Used for stored data, JSON restore, and before
// every save, so invalid data can never be persisted.
export function validateAppData(input: unknown): AppDataResult {
  const parsed = appDataSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => {
      const path = issue.path.map(String).join('.');
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    });
    return { ok: false, errors: limitErrors(messages) };
  }

  const problems = findReferenceProblems(parsed.data);
  if (problems.length > 0) {
    return { ok: false, errors: limitErrors(problems) };
  }
  return { ok: true, data: parsed.data };
}

// A badly damaged file could produce thousands of errors; show the first few.
function limitErrors(errors: string[]): string[] {
  if (errors.length <= MAX_REPORTED_ERRORS) {
    return errors;
  }
  const hidden = errors.length - MAX_REPORTED_ERRORS;
  return [...errors.slice(0, MAX_REPORTED_ERRORS), `...and ${hidden} more problems.`];
}

// Returns the set of ids, and reports any id that appears twice.
function collectIds(label: string, items: ReadonlyArray<{ id: string }>, errors: string[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      errors.push(`Duplicate ${label} id "${item.id}".`);
    }
    ids.add(item.id);
  }
  return ids;
}

function describeMovementProblems(
  label: string,
  id: string,
  movement: MoneyMovement,
  lookups: Lookups,
): string[] {
  const problems: string[] = [];
  const who = `${label} "${id}"`;

  if (!lookups.accountIds.has(movement.accountId)) {
    problems.push(`${who} uses an account that does not exist ("${movement.accountId}").`);
  }
  if (movement.toAccountId !== undefined && !lookups.accountIds.has(movement.toAccountId)) {
    problems.push(`${who} transfers to an account that does not exist ("${movement.toAccountId}").`);
  }
  if (movement.goalId !== undefined && !lookups.goalIds.has(movement.goalId)) {
    problems.push(`${who} refers to a savings goal that does not exist ("${movement.goalId}").`);
  }
  if (movement.categoryId !== null) {
    const category = lookups.categoriesById.get(movement.categoryId);
    if (category === undefined) {
      problems.push(`${who} uses a category that does not exist ("${movement.categoryId}").`);
    } else if (category.kind !== movement.type) {
      problems.push(
        `${who} is ${movement.type} but its category "${category.name}" is for ${category.kind}.`,
      );
    }
  }
  return problems;
}

function findReferenceProblems(data: AppData): string[] {
  const errors: string[] = [];

  const lookups: Lookups = {
    accountIds: collectIds('account', data.accounts, errors),
    categoriesById: new Map(data.categories.map((category) => [category.id, category])),
    goalIds: collectIds('savings goal', data.savingsGoals, errors),
  };
  collectIds('category', data.categories, errors);
  collectIds('transaction', data.transactions, errors);
  const recurringIds = collectIds('recurring item', data.recurringItems, errors);

  for (const transaction of data.transactions) {
    errors.push(...describeMovementProblems('Transaction', transaction.id, transaction, lookups));
    if (transaction.recurringId !== undefined && !recurringIds.has(transaction.recurringId)) {
      errors.push(
        `Transaction "${transaction.id}" refers to a recurring item that does not exist ("${transaction.recurringId}").`,
      );
    }
  }

  for (const item of data.recurringItems) {
    errors.push(...describeMovementProblems('Recurring item', item.id, item, lookups));
  }

  const budgetedCategories = new Set<string>();
  for (const budget of data.budgets) {
    if (budgetedCategories.has(budget.categoryId)) {
      errors.push(`More than one budget exists for category "${budget.categoryId}".`);
    }
    budgetedCategories.add(budget.categoryId);

    const category = lookups.categoriesById.get(budget.categoryId);
    if (category === undefined) {
      errors.push(`A budget uses a category that does not exist ("${budget.categoryId}").`);
    } else if (category.kind !== 'expense') {
      errors.push(`The budget for "${category.name}" is invalid: budgets apply to expense categories only.`);
    }
  }

  return errors;
}