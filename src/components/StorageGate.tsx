import type { ReactNode } from 'react';
import { useAppData } from '../hooks/useAppData';
import StoreMessage from './StoreMessage';

interface StorageGateProps {
  children: ReactNode;
}

// Shows the app only when valid data is loaded. In every other situation it
// explains what happened and offers only actions that are safe.
export default function StorageGate({ children }: StorageGateProps) {
  const { loadResult } = useAppData();

  switch (loadResult.status) {
    case 'loaded':
      return <>{children}</>;
    case 'empty':
      return <WelcomeScreen />;
    case 'corrupt':
      return <RecoveryScreen reason={loadResult.reason} />;
    case 'too-new':
      return (
        <BlockedScreen title="This data was saved by a newer version of the app">
          <p>
            The data in this browser was saved by version {loadResult.foundVersion} of the data format, which
            this version cannot read. Nothing has been changed. Open the latest version of the app to keep using
            your data.
          </p>
        </BlockedScreen>
      );
    case 'unavailable':
      return (
        <BlockedScreen title="Browser storage is unavailable">
          <p>
            This app keeps your data in your browser's storage, and the browser is not allowing it. Check that
            site data is enabled for this page (some private-browsing modes block it), then reload.
          </p>
          <p className="muted">{loadResult.reason}</p>
        </BlockedScreen>
      );
  }
}

function WelcomeScreen() {
  const { loadDemoData, startFresh } = useAppData();
  return (
    <main className="gate card stack">
      <h1>Personal Finance Command Center</h1>
      <p>
        Track spending, plan budgets, and forecast cash flow. Everything stays in this browser. Nothing is sent
        to a server.
      </p>
      <StoreMessage />
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={loadDemoData}>
          Explore with demo data
        </button>
        <button type="button" className="button" onClick={startFresh}>
          Start with my own data
        </button>
      </div>
      <p className="muted">Demo data is fictional, and you can remove it at any time.</p>
    </main>
  );
}

interface RecoveryScreenProps {
  reason: string;
}

function RecoveryScreen({ reason }: RecoveryScreenProps) {
  const { moveDamagedDataAside } = useAppData();
  return (
    <main className="gate card stack">
      <h1>Your saved data could not be read</h1>
      <p>
        The data saved in this browser is damaged or incomplete, so the app has not changed it. You can move it
        aside and start over. A backup copy of the damaged data stays in this browser.
      </p>
      <details>
        <summary>Technical details</summary>
        <p>{reason}</p>
      </details>
      <StoreMessage />
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={moveDamagedDataAside}>
          Move damaged data aside and start over
        </button>
      </div>
    </main>
  );
}

interface BlockedScreenProps {
  title: string;
  children: ReactNode;
}

function BlockedScreen({ title, children }: BlockedScreenProps) {
  return (
    <main className="gate card stack">
      <h1>{title}</h1>
      {children}
    </main>
  );
}