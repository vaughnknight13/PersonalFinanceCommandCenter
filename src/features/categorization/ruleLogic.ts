import { categoryRuleSchema, type AppData, type Category, type CategoryRule } from '../../types/finance';
import { normalizeForMatching } from './categorizer';

export interface RuleFormValues {
  keyword: string;
  categoryId: string;
}

export type RuleFormField = keyof RuleFormValues;
export type RuleFormErrors = Partial<Record<RuleFormField, string>>;
export type RuleFormResult = { ok: true; rule: CategoryRule } | { ok: false; errors: RuleFormErrors };

export const RULE_FIELD_ORDER: readonly RuleFormField[] = ['keyword', 'categoryId'];

export function emptyRuleForm(): RuleFormValues {
  return { keyword: '', categoryId: '' };
}

export function ruleFormFromRule(rule: CategoryRule): RuleFormValues {
  return { keyword: rule.keyword, categoryId: rule.categoryId };
}

// The keyword is stored as the user typed it, but two rules count as the
// same when their normalized forms match ("Maple & Main" and "maple main").
// Two rules with the same keyword would make the result depend on their
// order, so duplicates are rejected.
export function validateRuleForm(
  values: RuleFormValues,
  id: string,
  existingRules: readonly CategoryRule[],
  categories: readonly Category[],
): RuleFormResult {
  const errors: RuleFormErrors = {};

  if (!categories.some((category) => category.id === values.categoryId)) {
    errors.categoryId = 'Choose a category.';
  }

  const parsed = categoryRuleSchema.safeParse({ id, keyword: values.keyword, categoryId: values.categoryId });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'keyword' && errors.keyword === undefined) {
        errors.keyword = issue.message;
      }
    }
  }

  const normalized = normalizeForMatching(values.keyword);
  if (errors.keyword === undefined && normalized === '') {
    errors.keyword = 'Use at least one letter or number.';
  }

  const isDuplicate = existingRules.some(
    (rule) => rule.id !== id && normalizeForMatching(rule.keyword) === normalized,
  );
  if (errors.keyword === undefined && isDuplicate) {
    errors.keyword = `You already have a rule for "${normalized}".`;
  }

  if (parsed.success && Object.keys(errors).length === 0) {
    return { ok: true, rule: parsed.data };
  }
  return { ok: false, errors };
}

export function addRule(data: AppData, rule: CategoryRule): AppData {
  return { ...data, categoryRules: [...data.categoryRules, rule] };
}

export function replaceRule(data: AppData, rule: CategoryRule): AppData {
  return {
    ...data,
    categoryRules: data.categoryRules.map((existing) => (existing.id === rule.id ? rule : existing)),
  };
}

export function removeRule(data: AppData, ruleId: string): AppData {
  return { ...data, categoryRules: data.categoryRules.filter((existing) => existing.id !== ruleId) };
}