import { categorySchema, type AppData, type Category } from '../../types/finance';
import { pluralize } from '../../utils/plural';

export interface CategoryFormValues {
  name: string;
  kind: string;
}

export type CategoryFormField = keyof CategoryFormValues;
export type CategoryFormErrors = Partial<Record<CategoryFormField, string>>;
export type CategoryFormResult = { ok: true; category: Category } | { ok: false; errors: CategoryFormErrors };

export function emptyCategoryForm(): CategoryFormValues {
  return { name: '', kind: 'expense' };
}

export function categoryFormFromCategory(category: Category): CategoryFormValues {
  return { name: category.name, kind: category.kind };
}

// A category's kind (income or expense) is fixed once it exists. Changing it
// would silently break every transaction that uses it, because income may
// only use income categories and expenses only expense categories.
// Names must be unique within a kind, ignoring capitals.
export function validateCategoryForm(
  values: CategoryFormValues,
  id: string,
  existingCategories: readonly Category[],
  editing: Category | undefined,
): CategoryFormResult {
  const kind = editing === undefined ? values.kind : editing.kind;
  const errors: CategoryFormErrors = {};

  const parsed = categorySchema.safeParse({ id, name: values.name, kind });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] === 'kind' ? 'kind' : 'name';
      if (errors[field] === undefined) {
        errors[field] = issue.message;
      }
    }
  }

  const wantedName = values.name.trim().toLowerCase();
  const isDuplicate = existingCategories.some(
    (category) => category.id !== id && category.kind === kind && category.name.trim().toLowerCase() === wantedName,
  );
  if (errors.name === undefined && isDuplicate) {
    errors.name = `You already have an ${kind} category with this name.`;
  }

  if (parsed.success && Object.keys(errors).length === 0) {
    return { ok: true, category: parsed.data };
  }
  return { ok: false, errors };
}

export interface CategoryUsage {
  transactionCount: number;
  recurringCount: number;
  hasBudget: boolean;
}

const NO_USAGE: CategoryUsage = { transactionCount: 0, recurringCount: 0, hasBudget: false };

export function categoryUsageById(data: AppData): Map<string, CategoryUsage> {
  const usage = new Map<string, CategoryUsage>();

  function entryFor(categoryId: string): CategoryUsage {
    let entry = usage.get(categoryId);
    if (entry === undefined) {
      entry = { transactionCount: 0, recurringCount: 0, hasBudget: false };
      usage.set(categoryId, entry);
    }
    return entry;
  }

  for (const transaction of data.transactions) {
    if (transaction.categoryId !== null) {
      entryFor(transaction.categoryId).transactionCount += 1;
    }
  }
  for (const item of data.recurringItems) {
    if (item.categoryId !== null) {
      entryFor(item.categoryId).recurringCount += 1;
    }
  }
  for (const budget of data.budgets) {
    entryFor(budget.categoryId).hasBudget = true;
  }
  return usage;
}

// null means the category can be deleted. A category's budget is not a
// reason to keep it: the budget is deleted along with it.
export function deleteCategoryProblem(data: AppData, categoryId: string): string | null {
  const category = data.categories.find((existing) => existing.id === categoryId);
  if (category === undefined) {
    return 'This category no longer exists.';
  }

  const usage = categoryUsageById(data).get(categoryId) ?? NO_USAGE;
  if (usage.transactionCount > 0) {
    return `This category is used by ${pluralize(usage.transactionCount, 'transaction')}. Change those to another category first.`;
  }
  if (usage.recurringCount > 0) {
    return `This category is used by ${pluralize(usage.recurringCount, 'recurring item')}. Change those first.`;
  }

  const sameKindCount = data.categories.filter((existing) => existing.kind === category.kind).length;
  if (sameKindCount <= 1) {
    return `You need at least one ${category.kind} category.`;
  }
  return null;
}

export function addCategory(data: AppData, category: Category): AppData {
  return { ...data, categories: [...data.categories, category] };
}

export function replaceCategory(data: AppData, category: Category): AppData {
  return {
    ...data,
    categories: data.categories.map((existing) => (existing.id === category.id ? category : existing)),
  };
}

// Removes the category, its budget (if it has one) and any keyword rules that point at it.
export function removeCategory(data: AppData, categoryId: string): AppData {
  return {
    ...data,
    categories: data.categories.filter((existing) => existing.id !== categoryId),
    budgets: data.budgets.filter((budget) => budget.categoryId !== categoryId),
    categoryRules: data.categoryRules.filter((rule) => rule.categoryId !== categoryId),
  };
}