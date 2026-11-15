import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../data/defaultCategories';
import type { StorageActionResult } from '../../services/storage';
import { makeValidData } from '../../test/fixtures';
import type { AppData } from '../../types/finance';
import TransactionManager from './TransactionManager';

// Uses the real default categories so the built-in keyword rules apply.
function makeData(): AppData {
  return {
    ...makeValidData(),
    categories: [...DEFAULT_CATEGORIES],
    budgets: [],
    recurringItems: [],
    transactions: [
      {
        id: 't-1',
        date: '2026-10-02',
        description: 'Lunch',
        amountCents: 1_250,
        type: 'expense',
        categoryId: 'cat-dining',
        accountId: 'acct-1',
      },
    ],
  };
}

function Harness() {
  const [data, setData] = useState(makeData());

  function onChange(transform: (current: AppData) => AppData): StorageActionResult {
    setData(transform(data));
    return { ok: true };
  }

  return <TransactionManager data={data} today="2026-10-20" onChange={onChange} />;
}

function openAddForm(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
  return screen.getByRole('form', { name: 'Add transaction' });
}

function type(form: HTMLElement, label: string, value: string): void {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}

describe('automatic category suggestions in the form', () => {
  it('fills the category from the description and explains why', () => {
    render(<Harness />);
    const form = openAddForm();

    type(form, 'Description', 'Weekly grocery run');
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-groceries');
    expect(within(form).getByText(/Suggested because the text contains "grocery"/)).toBeInTheDocument();
  });

  it('clears the suggestion when the text no longer matches anything', () => {
    render(<Harness />);
    const form = openAddForm();

    type(form, 'Description', 'Weekly grocery run');
    type(form, 'Description', 'Weekly something');
    expect(within(form).getByLabelText('Category')).toHaveValue('');
    expect(within(form).queryByText(/Suggested because/)).not.toBeInTheDocument();
  });

  it('also reads the merchant', () => {
    render(<Harness />);
    const form = openAddForm();

    type(form, 'Merchant (optional)', 'Riverside Bistro');
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-dining');
  });

  it('never overrides a category the user chose', () => {
    render(<Harness />);
    const form = openAddForm();

    type(form, 'Category', 'cat-health');
    type(form, 'Description', 'Grocery run');
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-health');
    expect(within(form).queryByText(/Suggested because/)).not.toBeInTheDocument();
  });

  it('suggests income categories only for income', () => {
    render(<Harness />);
    const form = openAddForm();

    type(form, 'Description', 'Meridian Payroll');
    expect(within(form).getByLabelText('Category')).toHaveValue('');

    fireEvent.click(within(form).getByLabelText('Income'));
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-salary');
  });

  it('does not show a category for transfers', () => {
    render(<Harness />);
    const form = openAddForm();

    type(form, 'Description', 'Weekly grocery run');
    fireEvent.click(within(form).getByLabelText('Transfer'));
    expect(within(form).queryByLabelText('Category')).not.toBeInTheDocument();
    expect(within(form).queryByText(/Suggested because/)).not.toBeInTheDocument();
  });

  it('keeps an existing transaction category when its description is edited', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lunch' }));
    const form = screen.getByRole('form', { name: 'Edit transaction' });

    type(form, 'Description', 'Grocery run');
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-dining');
  });

  it('saves a transaction with the suggested category', () => {
    render(<Harness />);
    const form = openAddForm();

    type(form, 'Description', 'Weekly grocery run');
    type(form, 'Amount', '45.20');
    fireEvent.click(within(form).getByRole('button', { name: 'Save transaction' }));

    expect(screen.getByText('Transaction added.')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Groceries')).toBeInTheDocument();
  });
});