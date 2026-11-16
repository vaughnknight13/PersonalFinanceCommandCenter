import { describe, expect, it } from 'vitest';
import { makeValidData } from '../../test/fixtures';
import type { Category, CategoryRule } from '../../types/finance';
import {
  addRule,
  emptyRuleForm,
  removeRule,
  replaceRule,
  ruleFormFromRule,
  validateRuleForm,
  type RuleFormErrors,
  type RuleFormValues,
} from './ruleLogic';

const categories: Category[] = [
  { id: 'food', name: 'Food', kind: 'expense' },
  { id: 'pay', name: 'Pay', kind: 'income' },
];

const existing: CategoryRule[] = [{ id: 'r1', keyword: 'Maple & Main', categoryId: 'food' }];

function values(overrides: Partial<RuleFormValues> = {}): RuleFormValues {
  return { keyword: 'Bean Barn', categoryId: 'food', ...overrides };
}

function errorsOf(overrides: Partial<RuleFormValues> = {}, id = 'new'): RuleFormErrors {
  const result = validateRuleForm(values(overrides), id, existing, categories);
  return result.ok ? {} : result.errors;
}

describe('validateRuleForm', () => {
  it('builds a rule, trimming the keyword', () => {
    expect(validateRuleForm(values({ keyword: '  Bean Barn  ' }), 'new', existing, categories)).toEqual({
      ok: true,
      rule: { id: 'new', keyword: 'Bean Barn', categoryId: 'food' },
    });
  });

  it('accepts a rule for an income category', () => {
    expect(validateRuleForm(values({ keyword: 'Acme', categoryId: 'pay' }), 'new', existing, categories).ok).toBe(true);
  });

  it('requires a keyword of reasonable length', () => {
    expect(errorsOf({ keyword: '' }).keyword).toBe('Enter a keyword.');
    expect(errorsOf({ keyword: '   ' }).keyword).toBe('Enter a keyword.');
    expect(errorsOf({ keyword: 'x'.repeat(61) }).keyword).toBe('Keep this to 60 characters or fewer.');
  });

  it('requires a keyword with at least one letter or number', () => {
    expect(errorsOf({ keyword: '&&& !!!' }).keyword).toBe('Use at least one letter or number.');
  });

  it('requires an existing category', () => {
    expect(errorsOf({ categoryId: '' }).categoryId).toBe('Choose a category.');
    expect(errorsOf({ categoryId: 'deleted' }).categoryId).toBe('Choose a category.');
  });

  it('rejects a keyword that matches an existing rule once normalized', () => {
    expect(errorsOf({ keyword: 'maple main' }).keyword).toBe('You already have a rule for "maple main".');
    expect(errorsOf({ keyword: 'MAPLE & MAIN!' }).keyword).toBe('You already have a rule for "maple main".');
  });

  it('lets a rule keep its own keyword when edited', () => {
    const result = validateRuleForm(values({ keyword: 'maple & main', categoryId: 'pay' }), 'r1', existing, categories);
    expect(result.ok).toBe(true);
  });

  it('reports every problem at once', () => {
    const errors = errorsOf({ keyword: '', categoryId: '' });
    expect(errors.keyword).toBeDefined();
    expect(errors.categoryId).toBeDefined();
  });
});

describe('rule form values', () => {
  it('starts empty and turns a rule into editable text', () => {
    expect(emptyRuleForm()).toEqual({ keyword: '', categoryId: '' });
    expect(ruleFormFromRule({ id: 'r1', keyword: 'Maple & Main', categoryId: 'food' })).toEqual({
      keyword: 'Maple & Main',
      categoryId: 'food',
    });
  });
});

describe('rule changes', () => {
  const newRule: CategoryRule = { id: 'r2', keyword: 'Bean Barn', categoryId: 'cat-food' };

  it('adds, replaces and removes without changing the original data', () => {
    const data = { ...makeValidData(), categoryRules: [{ id: 'r1', keyword: 'Maple', categoryId: 'cat-food' }] };

    expect(addRule(data, newRule).categoryRules.map((rule) => rule.id)).toEqual(['r1', 'r2']);
    expect(replaceRule(data, { id: 'r1', keyword: 'Maple Main', categoryId: 'cat-food' }).categoryRules[0]?.keyword).toBe(
      'Maple Main',
    );
    expect(removeRule(data, 'r1').categoryRules).toEqual([]);

    expect(data.categoryRules).toHaveLength(1);
    expect(data.categoryRules[0]?.keyword).toBe('Maple');
  });

  it('leaves everything except the rules alone', () => {
    const data = makeValidData();
    const result = addRule(data, newRule);
    expect(result.transactions).toBe(data.transactions);
    expect(result.categories).toBe(data.categories);
  });
});