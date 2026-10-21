import { useState } from 'react';
import { createDemoData } from './data/demoData';
import {
  clearAllData,
  loadAppData,
  quarantineStoredData,
  saveAppData,
  type LoadResult,
  type StorageActionResult,
} from './services/storage';
import { todayIso } from './utils/dates';

function statusText(result: LoadResult): string {
  switch (result.status) {
    case 'empty':
      return 'No saved data yet';
    case 'loaded':
      return result.data.isDemo ? 'Demo data loaded' : 'Your data loaded';
    case 'corrupt':
      return 'Saved data is damaged';
    case 'too-new':
      return 'Saved data comes from a newer version of this app';
    case 'unavailable':
      return 'Browser storage is unavailable';
  }
}

// Temporary page that exercises the storage layer. Milestone 3 replaces it.
export default function App() {
  const [loadResult, setLoadResult] = useState<LoadResult>(() => loadAppData());
  const [message, setMessage] = useState('');

  const canChangeData = loadResult.status === 'empty' || loadResult.status === 'loaded';

  function finish(result: StorageActionResult): void {
    setMessage(result.ok ? '' : result.error);
    setLoadResult(loadAppData());
  }

  function handleLoadDemo(): void {
    const replacingData = loadResult.status === 'loaded';
    if (replacingData && !window.confirm('Replace the data saved in this browser with demo data?')) {
      return;
    }
    finish(saveAppData(createDemoData(todayIso())));
  }

  function handleClear(): void {
    if (!window.confirm('Delete all data saved in this browser? This cannot be undone.')) {
      return;
    }
    finish(clearAllData());
  }

  function handleQuarantine(): void {
    finish(quarantineStoredData());
  }

  return (
    <main className="setup-check">
      <h1>Personal Finance Command Center</h1>
      <p className="setup-check__note">Setup check. This page is replaced when we build transactions.</p>

      <dl>
        <dt>Base path</dt>
        <dd>{import.meta.env.BASE_URL}</dd>
        <dt>Today (local)</dt>
        <dd>{todayIso()}</dd>
      </dl>

      <h2>Storage check</h2>
      <p role="status">{`Status: ${statusText(loadResult)}`}</p>

      {loadResult.status === 'corrupt' && <p>{loadResult.reason}</p>}
      {message !== '' && <p role="alert">{message}</p>}

      {loadResult.status === 'loaded' && (
        <dl>
          <dt>Accounts</dt>
          <dd>{loadResult.data.accounts.length}</dd>
          <dt>Categories</dt>
          <dd>{loadResult.data.categories.length}</dd>
          <dt>Transactions</dt>
          <dd>{loadResult.data.transactions.length}</dd>
          <dt>Budgets</dt>
          <dd>{loadResult.data.budgets.length}</dd>
          <dt>Recurring items</dt>
          <dd>{loadResult.data.recurringItems.length}</dd>
          <dt>Savings goals</dt>
          <dd>{loadResult.data.savingsGoals.length}</dd>
        </dl>
      )}

      <div className="setup-check__actions">
        <button type="button" onClick={handleLoadDemo} disabled={!canChangeData}>
          Load demo data
        </button>
        <button type="button" onClick={handleClear} disabled={!canChangeData}>
          Clear all data
        </button>
        {loadResult.status === 'corrupt' && (
          <button type="button" onClick={handleQuarantine}>
            Move damaged data aside
          </button>
        )}
      </div>
    </main>
  );
}