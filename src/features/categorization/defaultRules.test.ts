import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../data/defaultCategories';
import { createDemoData } from '../../data/demoData';
import { createCategorizer, normalizeForMatching } from './categorizer';
import { DEFAULT_KEYWORD_RULES } from './defaultRules';

describe('DEFAULT_KEYWORD_RULES', () => {
  it('only refers to categories that exist by default', () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((category) => category.id));
    for (const rule of DEFAULT_KEYWORD_RULES) {
      expect(ids.has(rule.categoryId), `${rule.keyword} -> ${rule.categoryId}`).toBe(true);
    }
  });

  it('uses keywords that are already in normalized form', () => {
    for (const rule of DEFAULT_KEYWORD_RULES) {
      expect(rule.keyword).not.toBe('');
      expect(normalizeForMatching(rule.keyword)).toBe(rule.keyword);
    }
  });

  it('never sends one keyword to two different categories', () => {
    const owners = new Map<string, string>();
    for (const rule of DEFAULT_KEYWORD_RULES) {
      const owner = owners.get(rule.keyword);
      expect(owner === undefined || owner === rule.categoryId, `"${rule.keyword}" is ambiguous`).toBe(true);
      owners.set(rule.keyword, rule.categoryId);
    }
  });
});

describe('default categorization in practice', () => {
  const categorize = createCategorizer(DEFAULT_CATEGORIES, DEFAULT_KEYWORD_RULES);

  it.each([
    ["Trader Joe's #442", 'expense', 'cat-groceries'],
    ['UBER *EATS Help.uber.com', 'expense', 'cat-dining'],
    ['UBER TRIP SAN FRANCISCO', 'expense', 'cat-transportation'],
    ['Shell Oil 57444', 'expense', 'cat-transportation'],
    ['CAFÉ LUNA', 'expense', 'cat-dining'],
    ['Netflix.com', 'expense', 'cat-subscriptions'],
    ['ACME PAYROLL DIRECT DEPOSIT', 'income', 'cat-salary'],
    ['Interest Payment', 'income', 'cat-interest'],
    ['Monthly rent', 'expense', 'cat-housing'],
    ['Amazon Mktp US', 'expense', 'cat-shopping'],
    ['CVS/PHARMACY #1234', 'expense', 'cat-health'],
    ['Refund from store', 'income', 'cat-refunds'],
    ['Car rental', 'expense', null],
    ['Loan interest', 'expense', null],
    ['Random thing', 'expense', null],
  ] as const)('categorizes "%s" (%s) as %s', (text, type, expected) => {
    expect(categorize(text, type)?.categoryId ?? null).toBe(expected);
  });

  it('agrees with every categorized demo transaction except the one with no keyword', () => {
    const data = createDemoData('2026-10-20');
    const demoCategorize = createCategorizer(data.categories, DEFAULT_KEYWORD_RULES);
    const disagreements = new Set<string>();

    for (const transaction of data.transactions) {
      if (transaction.type === 'transfer' || transaction.categoryId === null) {
        continue;
      }
      const text = `${transaction.description} ${transaction.merchant ?? ''}`;
      const suggestion = demoCategorize(text, transaction.type);
      if ((suggestion?.categoryId ?? null) !== transaction.categoryId) {
        disagreements.add(transaction.description);
      }
    }

    expect([...disagreements]).toEqual(['Laptop repair']);
  });
});