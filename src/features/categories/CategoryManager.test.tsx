import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageActionResult } from '../../services/storage';
import { makeValidData } from '../../test/fixtures';
import type { AppData } from '../../types/finance';
import CategoryManager from './CategoryManager';

interface HarnessProps {
  initial?: AppData;
  failSaves?: boolean;
}

function Harness({ initial, failSaves = false }: HarnessProps) {
  const [data, setData] = useState(initial ?? makeValidData());

  function onChange(transform: (current: AppData) => AppData): StorageActionResult {
    if (failSaves) {
      return { ok: false, error: 'Could not save: storage is full.' };
    }
    setData(transform(data));
    return { ok: true };
  }

  return <CategoryManager data={data} onChange={onChange} />;
}

function openAddForm(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
  return screen.getByRole('form', { name: 'Add category' });
}

function withSpareCategory(): AppData {
  const data = makeValidData();
  return {
    ...data,
    categories: [...data.categories, { id: 'cat-hobby', name: 'Hobbies', kind: 'expense' }],
    budgets: [...data.budgets, { categoryId: 'cat-hobby', monthlyLimitCents: 5_000 }],
  };
}

describe('CategoryManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists expense and income categories separately with usage and budgets', () => {
    render(<Harness />);

    expect(screen.getByRole('heading', { name: 'Expense categories' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Income categories' })).toBeInTheDocument();

    const food = screen.getByRole('rowheader', { name: 'Food' }).closest('tr') as HTMLElement;
    expect(within(food).getByText('1')).toBeInTheDocument();
    expect(within(food).getByText('Set')).toBeInTheDocument();
  });

  it('adds an expense category and an income category', () => {
    render(<Harness />);

    let form = openAddForm();
    fireEvent.change(within(form).getByLabelText('Category name'), { target: { value: 'Travel' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save category' }));
    expect(screen.getByText('Category added.')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Travel' })).toBeInTheDocument();

    form = openAddForm();
    fireEvent.change(within(form).getByLabelText('Category name'), { target: { value: 'Side gig' } });
    fireEvent.click(within(form).getByLabelText('Income'));
    fireEvent.click(within(form).getByRole('button', { name: 'Save category' }));

    const incomeTable = screen.getByRole('table', { name: 'Income categories' });
    expect(within(incomeTable).getByRole('rowheader', { name: 'Side gig' })).toBeInTheDocument();
  });

  it('rejects empty and duplicate names, but allows the same name in the other kind', () => {
    render(<Harness />);
    const form = openAddForm();

    fireEvent.click(within(form).getByRole('button', { name: 'Save category' }));
    expect(within(form).getByText('Enter a category name.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Category name')).toHaveFocus();

    fireEvent.change(within(form).getByLabelText('Category name'), { target: { value: 'food' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save category' }));
    expect(within(form).getByText('You already have an expense category with this name.')).toBeInTheDocument();

    fireEvent.click(within(form).getByLabelText('Income'));
    fireEvent.click(within(form).getByRole('button', { name: 'Save category' }));
    expect(screen.getByText('Category added.')).toBeInTheDocument();
  });

  it('renames a category but locks its kind', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));

    const form = screen.getByRole('form', { name: 'Edit category' });
    expect(within(form).getByLabelText('Expense')).toBeDisabled();
    expect(within(form).getByLabelText('Income')).toBeDisabled();

    fireEvent.change(within(form).getByLabelText('Category name'), { target: { value: 'Meals' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Category updated.')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Meals' })).toBeInTheDocument();
  });

  it('explains why a category in use cannot be deleted', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Food' }));

    expect(screen.getByRole('alert')).toHaveTextContent('"Food" cannot be deleted. This category is used by 1 transaction.');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('warns that the budget goes too, and deletes only after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness initial={withSpareCategory()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Hobbies' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('budget will also be removed'));
    expect(screen.getByRole('rowheader', { name: 'Hobbies' })).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Hobbies' }));
    expect(screen.queryByRole('rowheader', { name: 'Hobbies' })).not.toBeInTheDocument();
    expect(screen.getByText('Category deleted.')).toBeInTheDocument();
  });

  it('never deletes the last category of a kind', () => {
    const data = { ...makeValidData(), transactions: [], recurringItems: [], budgets: [] };
    render(<Harness initial={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Food' }));
    expect(screen.getByRole('alert')).toHaveTextContent('You need at least one expense category.');
  });

  it('keeps the form open and shows the error when saving fails', () => {
    render(<Harness failSaves />);
    const form = openAddForm();
    fireEvent.change(within(form).getByLabelText('Category name'), { target: { value: 'Travel' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save category' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('Could not save: storage is full.');
  });

  it('warns that keyword rules are removed too', () => {
    const data = withSpareCategory();
    const initial: AppData = {
      ...data,
      categoryRules: [{ id: 'r1', keyword: 'Pottery', categoryId: 'cat-hobby' }],
    };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness initial={initial} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Hobbies' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('1 keyword rule will also be removed'));
  });
});