import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../data/defaultCategories';
import type { StorageActionResult } from '../../services/storage';
import { makeValidData } from '../../test/fixtures';
import type { AppData } from '../../types/finance';
import TransactionManager from './TransactionManager';

function makeData(): AppData {
  return {
    ...makeValidData(),
    categories: [...DEFAULT_CATEGORIES],
    budgets: [],
    recurringItems: [],
    transactions: [],
    categoryRules: [
      { id: 'r1', keyword: 'Maple & Main', categoryId: 'cat-health' },
      { id: 'r2', keyword: 'grocery', categoryId: 'cat-dining' },
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

describe('your keyword rules in the transaction form', () => {
  it('uses your rule and says it is yours', () => {
    render(<Harness />);
    const form = openAddForm();

    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Maple & Main' } });
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-health');
    expect(within(form).getByText('Suggested by your rule "maple main". You can choose a different category.')).toBeInTheDocument();
  });

  it('lets your rule beat the built-in one for the same word', () => {
    render(<Harness />);
    const form = openAddForm();

    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Grocery run' } });
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-dining');
  });

  it('still uses the built-in rules when none of yours match', () => {
    render(<Harness />);
    const form = openAddForm();

    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Monthly rent' } });
    expect(within(form).getByLabelText('Category')).toHaveValue('cat-housing');
    expect(within(form).getByText(/Suggested because the text contains "rent"/)).toBeInTheDocument();
  });
});