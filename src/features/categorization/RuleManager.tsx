import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StorageActionResult } from '../../services/storage';
import type { AppData, CategoryRule } from '../../types/finance';
import { createId } from '../../utils/ids';
import RuleTester from './RuleTester';
import {
  RULE_FIELD_ORDER,
  addRule,
  emptyRuleForm,
  removeRule,
  replaceRule,
  ruleFormFromRule,
  validateRuleForm,
  type RuleFormErrors,
  type RuleFormField,
  type RuleFormValues,
} from './ruleLogic';

type FormState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; rule: CategoryRule };

interface RuleManagerProps {
  data: AppData;
  onChange(transform: (data: AppData) => AppData): StorageActionResult;
}

export default function RuleManager({ data, onChange }: RuleManagerProps) {
  const [formState, setFormState] = useState<FormState>({ mode: 'closed' });
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));

  function openForm(state: FormState): void {
    setFormState(state);
    setNotice('');
    setProblem('');
  }

  function closeForm(): void {
    setFormState({ mode: 'closed' });
    addButtonRef.current?.focus();
  }

  function handleSave(rule: CategoryRule): StorageActionResult {
    const isEdit = formState.mode === 'edit';
    const result = onChange((current) => (isEdit ? replaceRule(current, rule) : addRule(current, rule)));
    if (result.ok) {
      setNotice(isEdit ? 'Rule updated.' : 'Rule added.');
      closeForm();
    }
    return result;
  }

  function handleDelete(rule: CategoryRule): void {
    if (!window.confirm(`Delete the rule for "${rule.keyword}"?`)) {
      return;
    }
    const result = onChange((current) => removeRule(current, rule.id));
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setNotice('Rule deleted.');
    setProblem('');
    setFormState((current) => (current.mode === 'edit' && current.rule.id === rule.id ? { mode: 'closed' } : current));
  }

  return (
    <section className="card stack" aria-labelledby="rules-heading">
      <div className="page-header">
        <h2 id="rules-heading">Your keyword rules</h2>
        <button
          ref={addButtonRef}
          type="button"
          className="button button--primary"
          onClick={() => openForm({ mode: 'add' })}
        >
          Add rule
        </button>
      </div>
      <p className="muted">
        Your rules are checked before the built-in ones. A rule matches whole words in the description or merchant,
        ignoring capital letters and punctuation.
      </p>

      <p role="status" className={notice === '' ? 'visually-hidden' : 'notice'}>
        {notice}
      </p>
      {problem !== '' && (
        <p role="alert" className="notice notice--error">
          {problem}
        </p>
      )}

      {formState.mode !== 'closed' && (
        <RuleForm
          key={formState.mode === 'edit' ? formState.rule.id : 'new'}
          rule={formState.mode === 'edit' ? formState.rule : undefined}
          data={data}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      {data.categoryRules.length === 0 ? (
        <p className="muted">You have not added any rules yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="visually-hidden">Your keyword rules</caption>
            <thead>
              <tr>
                <th scope="col">Keyword</th>
                <th scope="col">Category</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.categoryRules.map((rule) => (
                <tr key={rule.id}>
                  <th scope="row">{rule.keyword}</th>
                  <td>{categoryNames.get(rule.categoryId) ?? 'Unknown category'}</td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="button button--small"
                      aria-label={`Edit rule ${rule.keyword}`}
                      onClick={() => openForm({ mode: 'edit', rule })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button button--small button--danger"
                      aria-label={`Delete rule ${rule.keyword}`}
                      onClick={() => handleDelete(rule)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RuleTester data={data} />
    </section>
  );
}

interface RuleFormProps {
  rule?: CategoryRule;
  data: AppData;
  onSave(rule: CategoryRule): StorageActionResult;
  onCancel(): void;
}

function RuleForm({ rule, data, onSave, onCancel }: RuleFormProps) {
  const isEditing = rule !== undefined;
  const [newId] = useState(() => createId());
  const [values, setValues] = useState<RuleFormValues>(() =>
    rule === undefined ? emptyRuleForm() : ruleFormFromRule(rule),
  );
  const [errors, setErrors] = useState<RuleFormErrors>({});
  const [formError, setFormError] = useState('');
  const keywordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    keywordRef.current?.focus();
  }, []);

  function fieldId(field: RuleFormField): string {
    return `rule-${field}`;
  }

  function setField(field: RuleFormField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = validateRuleForm(values, rule?.id ?? newId, data.categoryRules, data.categories);

    if (!result.ok) {
      setErrors(result.errors);
      setFormError('');
      const firstInvalid = RULE_FIELD_ORDER.find((field) => result.errors[field] !== undefined);
      if (firstInvalid !== undefined) {
        document.getElementById(fieldId(firstInvalid))?.focus();
      }
      return;
    }

    setErrors({});
    const saved = onSave(result.rule);
    setFormError(saved.ok ? '' : saved.error);
  }

  function fieldProps(field: RuleFormField, hintId?: string) {
    const describedBy: string[] = [];
    if (hintId !== undefined) {
      describedBy.push(hintId);
    }
    if (errors[field] !== undefined) {
      describedBy.push(`${fieldId(field)}-error`);
    }
    return {
      id: fieldId(field),
      'aria-invalid': errors[field] !== undefined,
      'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
    };
  }

  function renderError(field: RuleFormField) {
    const message = errors[field];
    if (message === undefined) {
      return null;
    }
    return (
      <p id={`${fieldId(field)}-error`} className="field-error">
        {message}
      </p>
    );
  }

  const expenseCategories = data.categories.filter((category) => category.kind === 'expense');
  const incomeCategories = data.categories.filter((category) => category.kind === 'income');

  return (
    <form className="form-panel stack" aria-labelledby="rule-form-heading" onSubmit={handleSubmit} noValidate>
      <h3 id="rule-form-heading">{isEditing ? 'Edit rule' : 'Add rule'}</h3>

      <div className="form-grid">
        <div className="field">
          <label htmlFor={fieldId('keyword')}>Keyword</label>
          <input
            {...fieldProps('keyword', 'rule-keyword-hint')}
            ref={keywordRef}
            type="text"
            autoComplete="off"
            value={values.keyword}
            onChange={(event) => setField('keyword', event.target.value)}
          />
          <p id="rule-keyword-hint" className="field-hint">
            Words to look for, such as &quot;Maple &amp; Main&quot; or &quot;farmers market&quot;.
          </p>
          {renderError('keyword')}
        </div>

        <div className="field">
          <label htmlFor={fieldId('categoryId')}>Category</label>
          <select
            {...fieldProps('categoryId')}
            value={values.categoryId}
            onChange={(event) => setField('categoryId', event.target.value)}
          >
            <option value="">Choose a category</option>
            <optgroup label="Expense">
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Income">
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          </select>
          {renderError('categoryId')}
        </div>
      </div>

      {formError !== '' && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button button--primary">
          {isEditing ? 'Save changes' : 'Save rule'}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}