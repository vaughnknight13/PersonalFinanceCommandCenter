import { describe, expect, it } from 'vitest';
import { makeValidData } from '../../test/fixtures';
import type { Category } from '../../types/finance';
import {
  addCategory,
  categoryFormFromCategory,
  categoryUsageById,
  deleteCategoryProblem,
  emptyCategoryForm,
  removeCategory,
  replaceCategory,
  validateCategoryForm,
  type CategoryFormErrors,
  type CategoryFormValues,
} from './categoryLogic';

const existing: Category[] = [
  { id: 'c1', name: 'Food', kind: 'expense' },
  { id: 'c2', name: 'Pay', kind: 'income' },
];

function values(overrides: Partial<CategoryFormValues> = {}): CategoryFormValues {
  return { name: 'Travel', kind: 'expense', ...overrides };
}

function errorsOf(overrides: Partial<CategoryFormValues> = {}, id = 'new', editing?: Category): CategoryFormErrors {
  const result = validateCategoryForm(values(overrides), id, existing, editing);
  return result.ok ? {} : result.errors;
}

describe('validateCategoryForm', () => {
  it('builds an expense or an income category', () => {
    expect(validateCategoryForm(values(), 'new', existing, undefined)).toEqual({
      ok: true,
      category: { id: 'new', name: 'Travel', kind: 'expense' },
    });
    const income = validateCategoryForm(values({ name: ' Side gig ', kind: 'income' }), 'new', existing, undefined);
    expect(income).toEqual({ ok: true, category: { id: 'new', name: 'Side gig', kind: 'income' } });
  });

  it('requires a name of reasonable length', () => {
    expect(errorsOf({ name: '' }).name).toBe('Enter a category name.');
    expect(errorsOf({ name: 'x'.repeat(61) }).name).toBe('Keep this to 60 characters or fewer.');
  });

  it('rejects a duplicate name within the same kind, ignoring capitals', () => {
    expect(errorsOf({ name: 'FOOD' }).name).toBe('You already have an expense category with this name.');
    expect(errorsOf({ name: 'pay', kind: 'income' }).name).toBe('You already have an income category with this name.');
  });

  it('allows the same name in the other kind', () => {
    expect(validateCategoryForm(values({ name: 'Food', kind: 'income' }), 'new', existing, undefined).ok).toBe(true);
  });

  it('keeps the kind fixed when editing, whatever the form says', () => {
    const food = existing[0] as Category;
    const result = validateCategoryForm(values({ name: 'Meals', kind: 'income' }), 'c1', existing, food);
    expect(result).toEqual({ ok: true, category: { id: 'c1', name: 'Meals', kind: 'expense' } });
  });

  it('allows a category to keep its own name when edited', () => {
    const food = existing[0] as Category;
    expect(validateCategoryForm(values({ name: 'Food' }), 'c1', existing, food).ok).toBe(true);
  });

  it('rejects an unknown kind', () => {
    expect(errorsOf({ kind: 'transfer' }).kind).toBeDefined();
  });
});

describe('category form values', () => {
  it('starts with an empty expense category', () => {
    expect(emptyCategoryForm()).toEqual({ name: '', kind: 'expense' });
  });

  it('turns a category into editable text', () => {
    expect(categoryFormFromCategory({ id: 'c2', name: 'Pay', kind: 'income' })).toEqual({ name: 'Pay', kind: 'income' });
  });
});

describe('categoryUsageById', () => {
  it('counts transactions, recurring items and budgets', () => {
    const usage = categoryUsageById(makeValidData());
    expect(usage.get('cat-food')).toEqual({ transactionCount: 1, recurringCount: 0, hasBudget: true });
    expect(usage.get('cat-pay')).toEqual({ transactionCount: 1, recurringCount: 1, hasBudget: false });
  });
});

describe('deleteCategoryProblem', () => {
  const withSpareCategories = () => {
    const data = makeValidData();
    return { ...data, categories: [...data.categories, { id: 'cat-spare', name: 'Spare', kind: 'expense' as const }] };
  };

  it('blocks deleting a category that transactions use', () => {
    expect(deleteCategoryProblem(makeValidData(), 'cat-food')).toContain('used by 1 transaction.');
  });

  it('blocks deleting a category that only a recurring item uses', () => {
    const data = { ...makeValidData(), transactions: [] };
    expect(deleteCategoryProblem(data, 'cat-pay')).toContain('used by 1 recurring item');
  });

  it('allows deleting an unused category, even if it has a budget', () => {
    const data = withSpareCategories();
    expect(deleteCategoryProblem(data, 'cat-spare')).toBeNull();
    const withBudget = { ...data, budgets: [...data.budgets, { categoryId: 'cat-spare', monthlyLimitCents: 5_000 }] };
    expect(deleteCategoryProblem(withBudget, 'cat-spare')).toBeNull();
  });

  it('never allows deleting the last category of a kind', () => {
    const data = { ...makeValidData(), transactions: [], recurringItems: [], budgets: [] };
    expect(deleteCategoryProblem(data, 'cat-food')).toBe('You need at least one expense category.');
    expect(deleteCategoryProblem(data, 'cat-pay')).toBe('You need at least one income category.');
  });

  it('reports a category that does not exist', () => {
    expect(deleteCategoryProblem(makeValidData(), 'nope')).toBe('This category no longer exists.');
  });
});

describe('category changes', () => {
  it('adds and replaces without changing the original data', () => {
    const data = makeValidData();
    const added = addCategory(data, { id: 'c9', name: 'Pets', kind: 'expense' });
    expect(added.categories.map((category) => category.id)).toEqual(['cat-food', 'cat-pay', 'c9']);

    const renamed = replaceCategory(data, { id: 'cat-food', name: 'Meals', kind: 'expense' });
    expect(renamed.categories.map((category) => category.name)).toEqual(['Meals', 'Pay']);
    expect(data.categories[0]?.name).toBe('Food');
  });

  it('removes a category together with its budget, and nothing else', () => {
    const data = makeValidData();
    const result = removeCategory(data, 'cat-food');
    expect(result.categories.map((category) => category.id)).toEqual(['cat-pay']);
    expect(result.budgets).toEqual([]);
    expect(result.transactions).toBe(data.transactions);
    expect(data.budgets).toHaveLength(1);
  });
});