import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StorageActionResult } from '../../services/storage';
import type { AppData, Transaction } from '../../types/finance';
import type { IsoDate } from '../../types/primitives';
import { createId } from '../../utils/ids';
import {
  FORM_FIELD_ORDER,
  emptyFormValues,
  validateTransactionForm,
  valuesFromTransaction,
  type FormErrors,
  type FormField,
  type TransactionFormValues,
} from './transactionFormLogic';

const TYPE_OPTIONS: ReadonlyArray<{ value: TransactionFormValues['type']; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

function fieldId(field: FormField): string {
  return `txn-${field}`;
}

interface TransactionFormProps {
  data: AppData;
  transaction?: Transaction; // present when editing
  today: IsoDate;
  onSave(transaction: Transaction): StorageActionResult;
  onCancel(): void;
}

export default function TransactionForm({ data, transaction, today, onSave, onCancel }: TransactionFormProps) {
  const isEditing = transaction !== undefined;
  const [newId] = useState(() => createId());
  const [values, setValues] = useState<TransactionFormValues>(() =>
    transaction === undefined
      ? emptyFormValues(today, data.accounts[0]?.id ?? '')
      : valuesFromTransaction(transaction),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const descriptionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    descriptionRef.current?.focus();
  }, []);

  const isTransfer = values.type === 'transfer';
  const categoryKind = values.type === 'income' ? 'income' : 'expense';
  const categoryOptions = data.categories.filter((category) => category.kind === categoryKind);

  function setField(field: FormField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  // A category only fits one kind of transaction, so switching type clears
  // a category that no longer fits.
  function handleTypeChange(type: TransactionFormValues['type']): void {
    setValues((current) => {
      const kind = type === 'income' ? 'income' : 'expense';
      const chosen = data.categories.find((category) => category.id === current.categoryId);
      const stillFits = type !== 'transfer' && chosen !== undefined && chosen.kind === kind;
      return { ...current, type, categoryId: stillFits ? current.categoryId : '' };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = validateTransactionForm(values, transaction?.id ?? newId, transaction);

    if (!result.ok) {
      setErrors(result.errors);
      setFormError(result.generalError);
      const firstInvalid = FORM_FIELD_ORDER.find((field) => result.errors[field] !== undefined);
      if (firstInvalid !== undefined) {
        document.getElementById(fieldId(firstInvalid))?.focus();
      }
      return;
    }

    setErrors({});
    const saved = onSave(result.transaction);
    setFormError(saved.ok ? '' : saved.error);
  }

  function fieldProps(field: FormField, hintId?: string) {
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

  function renderError(field: FormField) {
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

  return (
    <form className="card stack" aria-labelledby="transaction-form-heading" onSubmit={handleSubmit} noValidate>
      <h2 id="transaction-form-heading">{isEditing ? 'Edit transaction' : 'Add transaction'}</h2>

      <fieldset className="radio-group">
        <legend>Type</legend>
        {TYPE_OPTIONS.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="transaction-type"
              value={option.value}
              checked={values.type === option.value}
              onChange={() => handleTypeChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <div className="form-grid">
        <div className="field">
          <label htmlFor={fieldId('date')}>Date</label>
          <input
            {...fieldProps('date')}
            type="date"
            value={values.date}
            onChange={(event) => setField('date', event.target.value)}
          />
          {renderError('date')}
        </div>

        <div className="field">
          <label htmlFor={fieldId('description')}>Description</label>
          <input
            {...fieldProps('description')}
            ref={descriptionRef}
            type="text"
            autoComplete="off"
            value={values.description}
            onChange={(event) => setField('description', event.target.value)}
          />
          {renderError('description')}
        </div>

        <div className="field">
          <label htmlFor={fieldId('amount')}>Amount</label>
          <input
            {...fieldProps('amount', 'txn-amount-hint')}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={values.amount}
            onChange={(event) => setField('amount', event.target.value)}
          />
          <p id="txn-amount-hint" className="field-hint">
            A positive amount, such as 12.34. The type above decides what it means.
          </p>
          {renderError('amount')}
        </div>

        {!isTransfer && (
          <div className="field">
            <label htmlFor={fieldId('categoryId')}>Category</label>
            <select
              {...fieldProps('categoryId')}
              value={values.categoryId}
              onChange={(event) => setField('categoryId', event.target.value)}
            >
              <option value="">Choose a category</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {renderError('categoryId')}
          </div>
        )}

        <div className="field">
          <label htmlFor={fieldId('accountId')}>{isTransfer ? 'From account' : 'Account'}</label>
          <select
            {...fieldProps('accountId')}
            value={values.accountId}
            onChange={(event) => setField('accountId', event.target.value)}
          >
            <option value="">Choose an account</option>
            {data.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          {renderError('accountId')}
        </div>

        {isTransfer && (
          <>
            <div className="field">
              <label htmlFor={fieldId('toAccountId')}>To account</label>
              <select
                {...fieldProps('toAccountId')}
                value={values.toAccountId}
                onChange={(event) => setField('toAccountId', event.target.value)}
              >
                <option value="">Choose an account</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {renderError('toAccountId')}
            </div>

            <div className="field">
              <label htmlFor={fieldId('goalId')}>Savings goal (optional)</label>
              <select
                {...fieldProps('goalId')}
                value={values.goalId}
                onChange={(event) => setField('goalId', event.target.value)}
              >
                <option value="">Not a goal contribution</option>
                {data.savingsGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
              {renderError('goalId')}
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor={fieldId('merchant')}>Merchant (optional)</label>
          <input
            {...fieldProps('merchant')}
            type="text"
            autoComplete="off"
            value={values.merchant}
            onChange={(event) => setField('merchant', event.target.value)}
          />
          {renderError('merchant')}
        </div>

        <div className="field field--full">
          <label htmlFor={fieldId('notes')}>Notes (optional)</label>
          <textarea
            {...fieldProps('notes')}
            rows={3}
            value={values.notes}
            onChange={(event) => setField('notes', event.target.value)}
          />
          {renderError('notes')}
        </div>
      </div>

      {formError !== '' && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button button--primary">
          {isEditing ? 'Save changes' : 'Save transaction'}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}