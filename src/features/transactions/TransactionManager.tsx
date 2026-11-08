import { useRef, useState } from 'react';
import type { StorageActionResult } from '../../services/storage';
import type { AppData, Transaction } from '../../types/finance';
import type { IsoDate } from '../../types/primitives';
import { formatDisplayDate } from '../../utils/dates';
import { formatTransactionAmount } from './display';
import { addTransaction, removeTransaction, replaceTransaction } from './mutations';
import TransactionBrowser from './TransactionBrowser';
import TransactionEntryForm from './TransactionEntryForm';

type FormState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; transaction: Transaction };

interface TransactionManagerProps {
  data: AppData;
  today: IsoDate;
  onChange(transform: (data: AppData) => AppData): StorageActionResult;
}

export default function TransactionManager({ data, today, onChange }: TransactionManagerProps) {
  const [formState, setFormState] = useState<FormState>({ mode: 'closed' });
  const [notice, setNotice] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);

  function openForm(state: FormState): void {
    setFormState(state);
    setNotice('');
    setDeleteError('');
  }

  function closeForm(): void {
    setFormState({ mode: 'closed' });
    addButtonRef.current?.focus(); // keep keyboard users where they were
  }

  function handleSave(transaction: Transaction): StorageActionResult {
    const isEdit = formState.mode === 'edit';
    const result = onChange((current) =>
      isEdit ? replaceTransaction(current, transaction) : addTransaction(current, transaction),
    );
    if (result.ok) {
      setNotice(isEdit ? 'Transaction updated.' : 'Transaction added.');
      closeForm();
    }
    return result; // on failure the form stays open and shows the error
  }

  function handleDelete(transaction: Transaction): void {
    const summary = `${transaction.description}, ${formatDisplayDate(transaction.date)}, ${formatTransactionAmount(transaction)}`;
    if (!window.confirm(`Delete this transaction?\n\n${summary}\n\nThis cannot be undone.`)) {
      return;
    }

    const result = onChange((current) => removeTransaction(current, transaction.id));
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setNotice('Transaction deleted.');
    setDeleteError('');
    setFormState((current) =>
      current.mode === 'edit' && current.transaction.id === transaction.id ? { mode: 'closed' } : current,
    );
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Transactions</h1>
        <button
          ref={addButtonRef}
          type="button"
          className="button button--primary"
          onClick={() => openForm({ mode: 'add' })}
        >
          Add transaction
        </button>
      </div>

      {/* Always on the page, so screen readers announce changes to its text. */}
      <p role="status" className={notice === '' ? 'visually-hidden' : 'notice'}>
        {notice}
      </p>
      {deleteError !== '' && (
        <p role="alert" className="notice notice--error">
          {deleteError}
        </p>
      )}

      {formState.mode !== 'closed' && (
        <TransactionEntryForm
          key={formState.mode === 'edit' ? formState.transaction.id : 'new'}
          data={data}
          transaction={formState.mode === 'edit' ? formState.transaction : undefined}
          today={today}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      <TransactionBrowser
        data={data}
        actions={{
          onEdit: (transaction) => openForm({ mode: 'edit', transaction }),
          onDelete: handleDelete,
        }}
      />
    </div>
  );
}