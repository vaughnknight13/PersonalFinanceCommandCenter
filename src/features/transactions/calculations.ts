import type { Transaction } from '../../types/finance';
import { isDateInRange, type DateRange } from '../../utils/dates';

export interface TransactionFilters {
  searchText: string;
  dateRange: DateRange | null;
  categoryId: string | null;
  type: Transaction['type'] | null;
  accountId: string | null;
}

export const EMPTY_FILTERS: TransactionFilters = {
  searchText: '',
  dateRange: null,
  categoryId: null,
  type: null,
  accountId: null,
};

function matchesSearch(transaction: Transaction, lowerCaseSearch: string): boolean {
  return (
    transaction.description.toLowerCase().includes(lowerCaseSearch) ||
    (transaction.merchant ?? '').toLowerCase().includes(lowerCaseSearch)
  );
}

// A filter that is null (or empty text) is "off". All active filters must match.
// Choosing an account also matches transfers INTO that account, because they
// appear on that account's statement too.
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const search = filters.searchText.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (
      filters.dateRange !== null &&
      !isDateInRange(transaction.date, filters.dateRange.start, filters.dateRange.end)
    ) {
      return false;
    }
    if (filters.type !== null && transaction.type !== filters.type) {
      return false;
    }
    if (filters.categoryId !== null && transaction.categoryId !== filters.categoryId) {
      return false;
    }
    if (
      filters.accountId !== null &&
      transaction.accountId !== filters.accountId &&
      transaction.toAccountId !== filters.accountId
    ) {
      return false;
    }
    if (search !== '' && !matchesSearch(transaction, search)) {
      return false;
    }
    return true;
  });
}

export type SortKey = 'date' | 'amount' | 'description';
export type SortDirection = 'asc' | 'desc';

function compareBy(key: SortKey, a: Transaction, b: Transaction): number {
  switch (key) {
    case 'date':
      return a.date.localeCompare(b.date);
    case 'amount':
      return a.amountCents - b.amountCents; // compares the size of the amount, whatever the type
    case 'description':
      return a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
  }
}

// Returns a sorted copy. Ties are always broken by id (ascending), so the
// order of equal rows is predictable and never shuffles between renders.
export function sortTransactions(
  transactions: readonly Transaction[],
  key: SortKey,
  direction: SortDirection,
): Transaction[] {
  const directionSign = direction === 'asc' ? 1 : -1;

  return [...transactions].sort((a, b) => {
    const primary = compareBy(key, a, b);
    if (primary !== 0) {
      return primary * directionSign;
    }
    return a.id.localeCompare(b.id);
  });
}

export interface Page<T> {
  items: T[];
  page: number; // the page actually returned (1-based), after clamping
  pageCount: number; // always at least 1, even when the list is empty
  totalItems: number;
}

// An out-of-range page number (for example, after a filter shrinks the list)
// is clamped instead of returning an empty page.
export function paginate<T>(items: readonly T[], requestedPage: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / size));
  const wanted = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(Math.max(wanted, 1), pageCount);
  const start = (page - 1) * size;

  return { items: items.slice(start, start + size), page, pageCount, totalItems };
}