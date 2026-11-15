import { NavLink, Outlet } from 'react-router-dom';
import { useAppData } from '../hooks/useAppData';
import StoreMessage from './StoreMessage';

function navClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link nav-link--active' : 'nav-link';
}

export default function AppLayout() {
  const { data, startFresh } = useAppData();

  function handleStartFresh(): void {
    if (window.confirm('Remove the demo data and start with an empty account?')) {
      startFresh();
    }
  }

  // A normal #main-content link would change the URL hash, which the router
  // would treat as a page, so the skip link moves focus by hand instead.
  function handleSkipLink(event: React.MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={handleSkipLink}>
        Skip to main content
      </a>

      <header className="app-header">
        <div className="app-header__inner">
          <span className="app-title">Personal Finance Command Center</span>
          <nav aria-label="Main">
            <ul className="nav-list">
              <li>
                <NavLink to="/" end className={navClassName}>
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/transactions" className={navClassName}>
                  Transactions
                </NavLink>
              </li>
              <li>
                <NavLink to="/manage" className={navClassName}>
                  Accounts &amp; categories
                </NavLink>
              </li>
              <li>
                <NavLink to="/settings" className={navClassName}>
                  Settings
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {data !== null && data.isDemo && (
        <div className="demo-banner" role="note">
          <span>
            <strong>Demo data.</strong> You are viewing fictional sample data.
          </span>
          <button type="button" className="button button--small" onClick={handleStartFresh}>
            Start with my own data
          </button>
        </div>
      )}

      <main id="main-content" className="app-main" tabIndex={-1}>
        <StoreMessage />
        <Outlet />
      </main>
    </div>
  );
}