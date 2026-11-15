import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageActionResult } from '../../services/storage';
import { makeValidData } from '../../test/fixtures';
import type { AppData } from '../../types/finance';
import AccountManager from './AccountManager';

interface HarnessProps {
  initial?: AppData;
  failSaves?: boolean;
}

// Stands in for the real data store: applies each change to local state.
function Harness({ initial, failSaves = false }: HarnessProps) {
  const [data, setData] = useState(initial ?? makeValidData());

  function onChange(transform: (current: AppData) => AppData): StorageActionResult {
    if (failSaves) {
      return { ok: false, error: 'Could not save: storage is full.' };
    }
    setData(transform(data));
    return { ok: true };
  }

  return <AccountManager data={data} today="2026-10-20" onChange={onChange} />;
}

function rowFor(accountName: string): HTMLElement {
  return screen.getByRole('rowheader', { name: accountName }).closest('tr') as HTMLElement;
}

function openAddForm(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
  return screen.getByRole('form', { name: 'Add account' });
}

function fillForm(form: HTMLElement, name: string, balance: string): void {
  fireEvent.change(within(form).getByLabelText('Account name'), { target: { value: name } });
  fireEvent.change(within(form).getByLabelText('Opening balance'), { target: { value: balance } });
}

describe('AccountManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists accounts with calculated balances and how many transactions use them', () => {
    render(<Harness />);

    const checking = rowFor('Checking');
    expect(within(checking).getByText('$1,000.00')).toBeInTheDocument(); // opening
    expect(within(checking).getByText('$2,487.50')).toBeInTheDocument(); // 1,000 + 2,000 - 12.50 - 500
    expect(within(checking).getByText('3')).toBeInTheDocument();

    const savings = rowFor('Savings');
    expect(within(savings).getByText('$500.00')).toBeInTheDocument();
    expect(within(savings).getByText('1')).toBeInTheDocument();
  });

  it('adds a credit card with a negative opening balance', () => {
    render(<Harness />);
    const form = openAddForm();

    fillForm(form, 'Travel Card', '-250');
    fireEvent.change(within(form).getByLabelText('Type'), { target: { value: 'credit' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save account' }));

    expect(screen.getByText('Account added.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    const card = rowFor('Travel Card');
    expect(within(card).getByText('Credit card')).toBeInTheDocument();
    expect(within(card).getAllByText('-$250.00')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add account' })).toHaveFocus();
  });

  it('shows problems next to the fields and focuses the first one', () => {
    render(<Harness />);
    const form = openAddForm();

    fillForm(form, '', 'abc');
    fireEvent.click(within(form).getByRole('button', { name: 'Save account' }));
    expect(within(form).getByText('Enter an account name.')).toBeInTheDocument();
    expect(within(form).getByText(/Enter a valid amount/)).toBeInTheDocument();
    expect(within(form).getByLabelText('Account name')).toHaveFocus();

    fillForm(form, 'checking', '0');
    fireEvent.click(within(form).getByRole('button', { name: 'Save account' }));
    expect(within(form).getByText('You already have an account with this name.')).toBeInTheDocument();
  });

  it('edits an account', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Savings' }));

    const form = screen.getByRole('form', { name: 'Edit account' });
    expect(within(form).getByLabelText('Account name')).toHaveValue('Savings');
    expect(within(form).getByLabelText('Opening balance')).toHaveValue('0.00');

    fillForm(form, 'Rainy Day', '0.00');
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Account updated.')).toBeInTheDocument();
    expect(rowFor('Rainy Day')).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'Savings' })).not.toBeInTheDocument();
  });

  it('explains why an account in use cannot be deleted, without asking to confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Checking' }));

    expect(screen.getByRole('alert')).toHaveTextContent('"Checking" cannot be deleted. This account is used by 3 transactions.');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(rowFor('Checking')).toBeInTheDocument();
  });

  it('deletes an unused account only after confirmation', () => {
    const data = makeValidData();
    const initial: AppData = {
      ...data,
      accounts: [...data.accounts, { id: 'acct-3', name: 'Spare', kind: 'cash', openingBalanceCents: 0 }],
    };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness initial={initial} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Spare' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Spare'));
    expect(rowFor('Spare')).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Spare' }));
    expect(screen.queryByRole('rowheader', { name: 'Spare' })).not.toBeInTheDocument();
    expect(screen.getByText('Account deleted.')).toBeInTheDocument();
  });

  it('keeps the form open and shows the error when saving fails', () => {
    render(<Harness failSaves />);
    const form = openAddForm();
    fillForm(form, 'Travel Card', '0');
    fireEvent.click(within(form).getByRole('button', { name: 'Save account' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('Could not save: storage is full.');
    expect(screen.queryByText('Account added.')).not.toBeInTheDocument();
  });
});