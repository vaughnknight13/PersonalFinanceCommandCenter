import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageActionResult } from '../../services/storage';
import { makeValidData } from '../../test/fixtures';
import type { AppData } from '../../types/finance';
import TransactionManager from './TransactionManager';

interface HarnessProps {
  failSaves?: boolean;
}

// Stands in for the real data store: applies each change to local state.
function Harness({ failSaves = false }: HarnessProps) {
  const [data, setData] = useState(makeValidData());

  function onChange(transform: (current: AppData) => AppData): StorageActionResult {
    if (failSaves) {
      return { ok: false, error: 'Could not save: storage is full.' };
    }
    setData(transform(data));
    return { ok: true };
  }

  return <TransactionManager data={data} today="2026-10-20" onChange={onChange} />;
}

function openAddForm(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
  return screen.getByRole('form', { name: 'Add transaction' });
}

function fillBasics(form: HTMLElement, description: string, amount: string): void {
  fireEvent.change(within(form).getByLabelText('Description'), { target: { value: description } });
  fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: amount } });
}

describe('TransactionManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds an expense', () => {
    render(<Harness />);
    const form = openAddForm();

    expect(within(form).getByLabelText('Date')).toHaveValue('2026-10-20');
    fillBasics(form, 'Tea', '3.25');
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'cat-food' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save transaction' }));

    expect(screen.getByText('Transaction added.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByText('Tea')).toBeInTheDocument();
    expect(screen.getByText('-$3.25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transaction' })).toHaveFocus();
  });

  it('shows every problem next to its field and focuses the first one', () => {
    render(<Harness />);
    const form = openAddForm();
    fireEvent.click(within(form).getByRole('button', { name: 'Save transaction' }));

    expect(within(form).getByText('Enter a description.')).toBeInTheDocument();
    expect(within(form).getByText('Enter an amount.')).toBeInTheDocument();
    expect(within(form).getByText('Choose a category.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Description')).toHaveFocus();
    expect(within(form).getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
  });

  it('adds a transfer to a savings goal', () => {
    render(<Harness />);
    const form = openAddForm();

    fireEvent.click(within(form).getByLabelText('Transfer'));
    expect(within(form).queryByLabelText('Category')).not.toBeInTheDocument();
    fillBasics(form, 'Top up', '100');

    fireEvent.change(within(form).getByLabelText('To account'), { target: { value: 'acct-1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save transaction' }));
    expect(within(form).getByText('A transfer needs two different accounts.')).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText('To account'), { target: { value: 'acct-2' } });
    fireEvent.change(within(form).getByLabelText('Savings goal (optional)'), { target: { value: 'goal-1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save transaction' }));

    expect(screen.getByText('Transaction added.')).toBeInTheDocument();
    expect(screen.getByText('Top up')).toBeInTheDocument();
    expect(screen.getAllByText('Checking → Savings')).toHaveLength(2);
  });

  it('clears a category that no longer fits when the type changes', () => {
    render(<Harness />);
    const form = openAddForm();

    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'cat-food' } });
    fireEvent.click(within(form).getByLabelText('Income'));
    expect(within(form).getByLabelText('Category')).toHaveValue('');
  });

  it('edits a transaction', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lunch' }));

    const form = screen.getByRole('form', { name: 'Edit transaction' });
    expect(within(form).getByLabelText('Description')).toHaveValue('Lunch');
    expect(within(form).getByLabelText('Amount')).toHaveValue('12.50');

    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '15.00' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Transaction updated.')).toBeInTheDocument();
    expect(screen.getByText('-$15.00')).toBeInTheDocument();
    expect(screen.queryByText('-$12.50')).not.toBeInTheDocument();
  });

  it('discards changes when an edit is cancelled', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lunch' }));
    const form = screen.getByRole('form', { name: 'Edit transaction' });

    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Changed' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.queryByText('Changed')).not.toBeInTheDocument();
  });

  it('deletes a transaction only after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Lunch'));
    expect(screen.getByText('Lunch')).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }));
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument();
    expect(screen.getByText('Transaction deleted.')).toBeInTheDocument();
  });

  it('closes the form when the transaction being edited is deleted', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Lunch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('keeps the form open and shows the error when saving fails', () => {
    render(<Harness failSaves />);
    const form = openAddForm();
    fillBasics(form, 'Tea', '3.25');
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'cat-food' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save transaction' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('Could not save: storage is full.');
    expect(screen.getByRole('form', { name: 'Add transaction' })).toBeInTheDocument();
    expect(screen.queryByText('Transaction added.')).not.toBeInTheDocument();
  });
});