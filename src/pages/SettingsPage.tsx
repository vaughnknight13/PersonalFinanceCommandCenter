import { useAppData, useLoadedData } from '../hooks/useAppData';

function confirmThen(question: string, action: () => void): void {
  if (window.confirm(question)) {
    action();
  }
}

export default function SettingsPage() {
  const data = useLoadedData();
  const { loadDemoData, startFresh, clearEverything } = useAppData();

  return (
    <div className="stack">
      <h1>Data and privacy</h1>

      <section className="card stack" aria-labelledby="data-heading">
        <h2 id="data-heading">Your data</h2>
        <p>
          {data.isDemo
            ? 'The app is showing fictional demo data.'
            : 'The app is showing the data saved in this browser.'}
        </p>
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => confirmThen('Replace the data in this browser with demo data?', loadDemoData)}
          >
            Load demo data
          </button>
          <button
            type="button"
            className="button"
            onClick={() => confirmThen('Replace the data in this browser with an empty account?', startFresh)}
          >
            Start with an empty account
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={() =>
              confirmThen('Delete all data saved in this browser? This cannot be undone.', clearEverything)
            }
          >
            Delete all data
          </button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Where your data lives</h2>
        <ul>
          <li>Your financial data is stored only in this browser. It is never sent to a server.</li>
          <li>It is not encrypted. Anyone who can use this browser profile can read it.</li>
          <li>
            GitHub Pages hosts the app's code, not your records. Each browser and device keeps its own separate
            data, and nothing syncs between them.
          </li>
          <li>Clearing this site's data in your browser, or switching browsers, means starting without it.</li>
        </ul>
      </section>
    </div>
  );
}