import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeValidData } from '../../test/fixtures';
import type { AppData, Transaction } from '../../types/finance';
import { addDays } from '../../utils/dates';
import TransactionBrowser from './TransactionBrowser';

// 60 expenses ("Purchase 1" to "Purchase 60"), one per day, so there are 3 pages of 25.
function makeManyTransactions(): AppData {
  const transactions: Transaction[] = Array.from({ length: 60 }, (_, index) => ({
    id: `x-${String(index + 1).padStart(3, '0')}`,
    date: addDays('2026-01-01', index),
    description: `Purchase ${index + 1}`,
    amountCents: 100 + index,
    type: 'expense',
    categoryId: 'cat-food',
    accountId: 'acct-1',
  }));
  return { ...makeValidData(), transactions };
}

function bodyRows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1); // the first row is the header
}

describe('TransactionBrowser', () => {
  it('shows the newest transactions first, one page at a time', () => {
    render(<TransactionBrowser data={makeManyTransactions()} />);

    expect(bodyRows()).toHaveLength(25);
    expect(within(bodyRows()[0] as HTMLElement).getByText('Purchase 60')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1.25 of 60 transactions/)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('moves between pages', () => {
    render(<TransactionBrowser data={makeManyTransactions()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByText(/Showing 26.50 of 60 transactions/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(bodyRows()).toHaveLength(10);
  });

  it('searches descriptions and returns to the first page', () => {
    render(<TransactionBrowser data={makeManyTransactions()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '17' } });

    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0] as HTMLElement).getByText('Purchase 17')).toBeInTheDocument();
    expect(screen.queryByText(/Page \d of \d/)).not.toBeInTheDocument();
  });

  it('shows a helpful empty state when nothing matches, and can clear the filters', () => {
    render(<TransactionBrowser data={makeManyTransactions()} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } });

    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('explains when there are no transactions at all', () => {
    render(<TransactionBrowser data={{ ...makeValidData(), transactions: [] }} />);
    expect(screen.getByText(/No transactions recorded yet/)).toBeInTheDocument();
  });

  it('sorts when a column heading is clicked, and reverses on a second click', () => {
    render(<TransactionBrowser data={makeManyTransactions()} />);
    const dateHeader = screen.getByRole('columnheader', { name: /Date/ });
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(within(bodyRows()[0] as HTMLElement).getByText('Purchase 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Description' }));
    expect(screen.getByRole('columnheader', { name: /Description/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(dateHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('filters by type and shows signed amounts and transfer accounts', () => {
    render(<TransactionBrowser data={makeValidData()} />);

    expect(screen.getByText('+$2,000.00')).toBeInTheDocument();
    expect(screen.getByText('-$12.50')).toBeInTheDocument();
    expect(screen.getByText('Checking → Savings')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'transfer' } });
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });

  it('includes transfers into an account when filtering by that account', () => {
    render(<TransactionBrowser data={makeValidData()} />);
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'acct-2' } });

    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Move to savings')).toBeInTheDocument();
  });

  it('reports an invalid date range without hiding the transactions', () => {
    render(<TransactionBrowser data={makeValidData()} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-31' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });

    expect(screen.getByRole('alert')).toHaveTextContent('The "from" date must be on or before the "to" date.');
    expect(bodyRows()).toHaveLength(3);
  });

  it('filters by date range, boundaries included', () => {
    render(<TransactionBrowser data={makeValidData()} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-02' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-02' } });

    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });
});