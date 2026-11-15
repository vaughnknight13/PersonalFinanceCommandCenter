import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StorageActionResult } from '../../services/storage';
import type { Account, AppData } from '../../types/finance';
import type { IsoDate } from '../../types/primitives';
import { createId } from '../../utils/ids';
import { formatCents } from '../../utils/money';
import { calculateAccountBalances } from '../dashboard/calculations';
import {
  ACCOUNT_FIELD_ORDER,
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LABELS,
  accountFormFromAccount,
  accountUsageById,
  addAccount,
  deleteAccountProblem,
  emptyAccountForm,
  removeAccount,
  replaceAccount,
  validateAccountForm,
  type AccountFormErrors,
  type AccountFormField,
  type AccountFormValues,
} from './accountLogic';

type FormState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; account: Account };

interface AccountManagerProps {
  data: AppData;
  today: IsoDate;
  onChange(transform: (data: AppData) => AppData): StorageActionResult;
}

export default function AccountManager({ data, today, onChange }: AccountManagerProps) {
  const [formState, setFormState] = useState<FormState>({ mode: 'closed' });
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const balances = new Map(
    calculateAccountBalances(data.accounts, data.transactions, today).map((balance) => [
      balance.accountId,
      balance.balanceCents,
    ]),
  );
  const usage = accountUsageById(data);

  function openForm(state: FormState): void {
    setFormState(state);
    setNotice('');
    setProblem('');
  }

  function closeForm(): void {
    setFormState({ mode: 'closed' });
    addButtonRef.current?.focus();
  }

  function handleSave(account: Account): StorageActionResult {
    const isEdit = formState.mode === 'edit';
    const result = onChange((current) => (isEdit ? replaceAccount(current, account) : addAccount(current, account)));
    if (result.ok) {
      setNotice(isEdit ? 'Account updated.' : 'Account added.');
      closeForm();
    }
    return result;
  }

  function handleDelete(account: Account): void {
    const blocked = deleteAccountProblem(data, account.id);
    if (blocked !== null) {
      setProblem(`"${account.name}" cannot be deleted. ${blocked}`);
      setNotice('');
      return;
    }
    if (!window.confirm(`Delete the account "${account.name}"? This cannot be undone.`)) {
      return;
    }
    const result = onChange((current) => removeAccount(current, account.id));
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setNotice('Account deleted.');
    setProblem('');
    setFormState((current) =>
      current.mode === 'edit' && current.account.id === account.id ? { mode: 'closed' } : current,
    );
  }

  return (
    <section className="card stack" aria-labelledby="accounts-heading">
      <div className="page-header">
        <h2 id="accounts-heading">Accounts</h2>
        <button
          ref={addButtonRef}
          type="button"
          className="button button--primary"
          onClick={() => openForm({ mode: 'add' })}
        >
          Add account
        </button>
      </div>

      <p role="status" className={notice === '' ? 'visually-hidden' : 'notice'}>
        {notice}
      </p>
      {problem !== '' && (
        <p role="alert" className="notice notice--error">
          {problem}
        </p>
      )}

      {formState.mode !== 'closed' && (
        <AccountForm
          key={formState.mode === 'edit' ? formState.account.id : 'new'}
          account={formState.mode === 'edit' ? formState.account : undefined}
          existingAccounts={data.accounts}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      <div className="table-wrap">
        <table className="data-table">
          <caption className="visually-hidden">Accounts</caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Type</th>
              <th scope="col" className="numeric">
                Opening balance
              </th>
              <th scope="col" className="numeric">
                Current balance
              </th>
              <th scope="col" className="numeric">
                Transactions
              </th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((account) => (
              <tr key={account.id}>
                <th scope="row">{account.name}</th>
                <td>{ACCOUNT_KIND_LABELS[account.kind]}</td>
                <td className="numeric">{formatCents(account.openingBalanceCents)}</td>
                <td className="numeric">{formatCents(balances.get(account.id) ?? account.openingBalanceCents)}</td>
                <td className="numeric">{usage.get(account.id)?.transactionCount ?? 0}</td>
                <td className="actions-cell">
                  <button
                    type="button"
                    className="button button--small"
                    aria-label={`Edit ${account.name}`}
                    onClick={() => openForm({ mode: 'edit', account })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button--small button--danger"
                    aria-label={`Delete ${account.name}`}
                    onClick={() => handleDelete(account)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        The current balance is calculated: the opening balance plus your recorded transactions up to today. It is not
        a balance reported by a bank.
      </p>
    </section>
  );
}

interface AccountFormProps {
  account?: Account;
  existingAccounts: readonly Account[];
  onSave(account: Account): StorageActionResult;
  onCancel(): void;
}

function AccountForm({ account, existingAccounts, onSave, onCancel }: AccountFormProps) {
  const isEditing = account !== undefined;
  const [newId] = useState(() => createId());
  const [values, setValues] = useState<AccountFormValues>(() =>
    account === undefined ? emptyAccountForm() : accountFormFromAccount(account),
  );
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const [formError, setFormError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function fieldId(field: AccountFormField): string {
    return `account-${field}`;
  }

  function setField(field: AccountFormField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = validateAccountForm(values, account?.id ?? newId, existingAccounts);

    if (!result.ok) {
      setErrors(result.errors);
      setFormError('');
      const firstInvalid = ACCOUNT_FIELD_ORDER.find((field) => result.errors[field] !== undefined);
      if (firstInvalid !== undefined) {
        document.getElementById(fieldId(firstInvalid))?.focus();
      }
      return;
    }

    setErrors({});
    const saved = onSave(result.account);
    setFormError(saved.ok ? '' : saved.error);
  }

  function fieldProps(field: AccountFormField, hintId?: string) {
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

  function renderError(field: AccountFormField) {
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
    <form className="form-panel stack" aria-labelledby="account-form-heading" onSubmit={handleSubmit} noValidate>
      <h3 id="account-form-heading">{isEditing ? 'Edit account' : 'Add account'}</h3>

      <div className="form-grid">
        <div className="field">
          <label htmlFor={fieldId('name')}>Account name</label>
          <input
            {...fieldProps('name')}
            ref={nameRef}
            type="text"
            autoComplete="off"
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
          />
          {renderError('name')}
        </div>

        <div className="field">
          <label htmlFor={fieldId('kind')}>Type</label>
          <select {...fieldProps('kind')} value={values.kind} onChange={(event) => setField('kind', event.target.value)}>
            {ACCOUNT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ACCOUNT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          {renderError('kind')}
        </div>

        <div className="field">
          <label htmlFor={fieldId('openingBalance')}>Opening balance</label>
          <input
            {...fieldProps('openingBalance', 'account-balance-hint')}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={values.openingBalance}
            onChange={(event) => setField('openingBalance', event.target.value)}
          />
          <p id="account-balance-hint" className="field-hint">
            The balance before your first recorded transaction. Use a minus sign if you owe money, such as -250.00
            on a credit card. Leave blank for 0.00.
          </p>
          {renderError('openingBalance')}
        </div>
      </div>

      {formError !== '' && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button button--primary">
          {isEditing ? 'Save changes' : 'Save account'}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}