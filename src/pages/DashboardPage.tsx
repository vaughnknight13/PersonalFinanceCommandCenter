import SummaryCheck from '../features/dashboard/SummaryCheck';
import { useLoadedData } from '../hooks/useAppData';
import { todayIso } from '../utils/dates';

// Temporary: the real dashboard replaces this in a later milestone.
export default function DashboardPage() {
  const data = useLoadedData();
  const today = todayIso();

  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="setup-check">
        <p className="setup-check__note">Temporary check page for the calculations.</p>
        <dl>
          <dt>Base path</dt>
          <dd>{import.meta.env.BASE_URL}</dd>
          <dt>Today (local)</dt>
          <dd>{today}</dd>
          <dt>Accounts</dt>
          <dd>{data.accounts.length}</dd>
          <dt>Categories</dt>
          <dd>{data.categories.length}</dd>
          <dt>Transactions</dt>
          <dd>{data.transactions.length}</dd>
          <dt>Budgets</dt>
          <dd>{data.budgets.length}</dd>
          <dt>Recurring items</dt>
          <dd>{data.recurringItems.length}</dd>
          <dt>Savings goals</dt>
          <dd>{data.savingsGoals.length}</dd>
        </dl>
        <SummaryCheck data={data} today={today} />
      </div>
    </div>
  );
}