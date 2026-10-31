import type { Transaction } from '../../types/finance';
import { formatDisplayDate } from '../../utils/dates';
import type { SortDirection, SortKey } from './calculations';
import {
  describeAccounts,
  describeCategory,
  formatTransactionAmount,
  transactionTypeLabel,
} from './display';

interface TransactionTableProps {
  transactions: readonly Transaction[];
  categoryNames: ReadonlyMap<string, string>;
  accountNames: ReadonlyMap<string, string>;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}

function ariaSortValue(isActive: boolean, direction: SortDirection): 'ascending' | 'descending' | 'none' {
  if (!isActive) {
    return 'none';
  }
  return direction === 'asc' ? 'ascending' : 'descending';
}

function sortArrow(isActive: boolean, direction: SortDirection): string {
  if (!isActive) {
    return '';
  }
  return direction === 'asc' ? ' ▲' : ' ▼';
}

function amountClassName(type: Transaction['type']): string {
  if (type === 'income') {
    return 'numeric amount--income';
  }
  if (type === 'expense') {
    return 'numeric amount--expense';
  }
  return 'numeric';
}

interface SortableHeaderProps {
  label: string;
  columnKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  numeric?: boolean;
}

function SortableHeader({ label, columnKey, activeKey, direction, onSort, numeric }: SortableHeaderProps) {
  const isActive = columnKey === activeKey;
  return (
    <th scope="col" aria-sort={ariaSortValue(isActive, direction)} className={numeric ? 'numeric' : undefined}>
      <button type="button" className="sort-button" onClick={() => onSort(columnKey)}>
        {label}
        <span aria-hidden="true">{sortArrow(isActive, direction)}</span>
      </button>
    </th>
  );
}

export default function TransactionTable({
  transactions,
  categoryNames,
  accountNames,
  sortKey,
  sortDirection,
  onSort,
}: TransactionTableProps) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="visually-hidden">Transactions</caption>
        <thead>
          <tr>
            <SortableHeader label="Date" columnKey="date" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
            <SortableHeader
              label="Description"
              columnKey="description"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={onSort}
            />
            <th scope="col">Category</th>
            <th scope="col">Account</th>
            <th scope="col">Type</th>
            <SortableHeader
              label="Amount"
              columnKey="amount"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={onSort}
              numeric
            />
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{formatDisplayDate(transaction.date)}</td>
              <td>
                {transaction.description}
                {transaction.merchant !== undefined && transaction.merchant !== '' && (
                  <span className="muted">{transaction.merchant}</span>
                )}
              </td>
              <td>{describeCategory(transaction, categoryNames)}</td>
              <td>{describeAccounts(transaction, accountNames)}</td>
              <td>{transactionTypeLabel(transaction.type)}</td>
              <td className={amountClassName(transaction.type)}>{formatTransactionAmount(transaction)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}