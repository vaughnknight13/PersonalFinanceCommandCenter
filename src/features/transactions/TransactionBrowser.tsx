import { useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import type { AppData, Transaction } from '../../types/finance';
import {
  dateRangeFromInputs,
  filterTransactions,
  paginate,
  sortTransactions,
  type Page,
  type SortDirection,
  type SortKey,
  type TransactionFilters,
} from './calculations';
import TransactionTable from './TransactionTable';

const PAGE_SIZE = 25;

// What the user has typed or chosen. All values are text; '' means "off".
interface FilterInputs {
  searchText: string;
  fromDate: string;
  toDate: string;
  categoryId: string;
  accountId: string;
  type: string;
}

const NO_INPUTS: FilterInputs = {
  searchText: '',
  fromDate: '',
  toDate: '',
  categoryId: '',
  accountId: '',
  type: '',
};

function toTypeFilter(value: string): Transaction['type'] | null {
  if (value === 'income' || value === 'expense' || value === 'transfer') {
    return value;
  }
  return null;
}

function describeShownRange(page: Page<Transaction>): string {
  const first = (page.page - 1) * PAGE_SIZE + 1;
  const last = first + page.items.length - 1;
  const noun = page.totalItems === 1 ? 'transaction' : 'transactions';
  return `Showing ${first}–${last} of ${page.totalItems} ${noun}`;
}

interface TransactionBrowserProps {
  data: AppData;
}

export default function TransactionBrowser({ data }: TransactionBrowserProps) {
  const [inputs, setInputs] = useState<FilterInputs>(NO_INPUTS);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [requestedPage, setRequestedPage] = useState(1);

  const categoryNames = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category.name])),
    [data.categories],
  );
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.id, account.name])),
    [data.accounts],
  );

  // Filtering and sorting walk the whole list, so they only re-run when the
  // data, a filter or the sort changes. Turning to the next page changes none
  // of those, so it reuses this result and only slices out a new page.
  const matches = useMemo(() => {
    const dateFilter = dateRangeFromInputs(inputs.fromDate, inputs.toDate);
    const filters: TransactionFilters = {
      searchText: inputs.searchText,
      dateRange: dateFilter.ok ? dateFilter.range : null, // an invalid range is not applied
      categoryId: inputs.categoryId === '' ? null : inputs.categoryId,
      type: toTypeFilter(inputs.type),
      accountId: inputs.accountId === '' ? null : inputs.accountId,
    };
    return sortTransactions(filterTransactions(data.transactions, filters), sortKey, sortDirection);
  }, [data.transactions, inputs, sortKey, sortDirection]);

  const dateFilterProblem = dateRangeFromInputs(inputs.fromDate, inputs.toDate);
  const page = paginate(matches, requestedPage, PAGE_SIZE);
  const hasActiveFilters = Object.values(inputs).some((value) => value !== '');

  function updateInput(field: keyof FilterInputs, value: string): void {
    setInputs((current) => ({ ...current, [field]: value }));
    setRequestedPage(1);
  }

  function clearFilters(): void {
    setInputs(NO_INPUTS);
    setRequestedPage(1);
  }

  function handleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Dates and amounts start with the newest/largest, text starts A to Z.
      setSortDirection(key === 'description' ? 'asc' : 'desc');
    }
    setRequestedPage(1);
  }

  return (
    <div className="stack">
      <h1>Transactions</h1>

      <div className="filter-bar" role="search" aria-label="Filter transactions">
        <div className="field field--wide">
          <label htmlFor="filter-search">Search</label>
          <input
            id="filter-search"
            type="search"
            placeholder="Description or merchant"
            value={inputs.searchText}
            onChange={(event) => updateInput('searchText', event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-type">Type</label>
          <select id="filter-type" value={inputs.type} onChange={(event) => updateInput('type', event.target.value)}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            value={inputs.categoryId}
            onChange={(event) => updateInput('categoryId', event.target.value)}
          >
            <option value="">All categories</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-account">Account</label>
          <select
            id="filter-account"
            value={inputs.accountId}
            onChange={(event) => updateInput('accountId', event.target.value)}
          >
            <option value="">All accounts</option>
            {data.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            value={inputs.fromDate}
            onChange={(event) => updateInput('fromDate', event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            value={inputs.toDate}
            onChange={(event) => updateInput('toDate', event.target.value)}
          />
        </div>
        <button type="button" className="button" onClick={clearFilters} disabled={!hasActiveFilters}>
          Clear filters
        </button>
      </div>

      {!dateFilterProblem.ok && (
        <p role="alert" className="field-error">
          {dateFilterProblem.error}
        </p>
      )}

      {data.transactions.length === 0 && (
        <p className="empty-state">
          No transactions recorded yet. Load demo data from Settings to see how the app works.
        </p>
      )}

      {data.transactions.length > 0 && page.totalItems === 0 && (
        <div className="empty-state">
          <p>No transactions match these filters.</p>
          <button type="button" className="button" onClick={clearFilters}>
            Clear all filters
          </button>
        </div>
      )}

      {page.totalItems > 0 && (
        <>
          <p className="muted" aria-live="polite">
            {describeShownRange(page)}
          </p>
          <TransactionTable
            transactions={page.items}
            categoryNames={categoryNames}
            accountNames={accountNames}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          {page.pageCount > 1 && (
            <Pagination page={page.page} pageCount={page.pageCount} onPageChange={setRequestedPage} />
          )}
        </>
      )}
    </div>
  );
}