import { todayIso } from './utils/dates';
import { formatCents } from './utils/money';

// Temporary page that proves the toolchain works. Milestone 2 replaces it.
export default function App() {
  return (
    <main className="setup-check">
      <h1>Personal Finance Command Center</h1>
      <p className="setup-check__note">
        Setup check. This page is replaced when we build transactions.
      </p>
      <dl>
        <dt>Base path</dt>
        <dd>{import.meta.env.BASE_URL}</dd>
        <dt>Today (local)</dt>
        <dd>{todayIso()}</dd>
        <dt>Money formatting</dt>
        <dd>{formatCents(123450)}</dd>
      </dl>
    </main>
  );
}