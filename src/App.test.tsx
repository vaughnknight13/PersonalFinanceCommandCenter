import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createDemoData } from './data/demoData';
import { BACKUP_KEY, STORAGE_KEY, saveAppData } from './services/storage';
import { todayIso } from './utils/dates';

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

function clickButton(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

function saveDemoDataBeforeLoad(): void {
  saveAppData(createDemoData(todayIso()));
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('welcomes a first-time visitor and offers a choice', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Personal Finance Command Center' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore with demo data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start with my own data' })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('loads demo data, saves it, and labels it as demo data', () => {
    renderApp();
    clickButton('Explore with demo data');

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByText(/fictional sample data/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calculation check' })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('opens straight into the app when data was saved earlier', () => {
    saveDemoDataBeforeLoad();
    renderApp();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore with demo data' })).not.toBeInTheDocument();
  });

  it('starts empty without a demo banner and explains the empty transaction list', () => {
    renderApp();
    clickButton('Start with my own data');

    expect(screen.queryByText(/fictional sample data/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Transactions' }));
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(screen.getByText(/No transactions recorded yet/)).toBeInTheDocument();
  });

  it('shows demo transactions on the transactions page', () => {
    saveDemoDataBeforeLoad();
    renderApp('/transactions');

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1.25 of \d+ transactions/)).toBeInTheDocument();
  });

  it('asks before removing demo data from the banner', () => {
    saveDemoDataBeforeLoad();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp();

    clickButton('Start with my own data');
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText(/fictional sample data/i)).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    clickButton('Start with my own data');
    expect(screen.queryByText(/fictional sample data/i)).not.toBeInTheDocument();
  });

  it('deletes all data only after confirmation', () => {
    saveDemoDataBeforeLoad();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp('/settings');

    clickButton('Delete all data');
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    confirmSpy.mockReturnValue(true);
    clickButton('Delete all data');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: 'Explore with demo data' })).toBeInTheDocument();
  });

  it('protects damaged data and lets the user move it aside', () => {
    window.localStorage.setItem(STORAGE_KEY, '{oops');
    renderApp();

    expect(screen.getByRole('heading', { name: 'Your saved data could not be read' })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{oops');

    clickButton('Move damaged data aside and start over');
    expect(screen.getByRole('button', { name: 'Explore with demo data' })).toBeInTheDocument();
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe('{oops');
  });

  it('does not touch data saved by a newer version of the app', () => {
    const newer = JSON.stringify({ schemaVersion: 99, savedAt: 'x', data: {} });
    window.localStorage.setItem(STORAGE_KEY, newer);
    renderApp();

    expect(screen.getByRole('heading', { name: /newer version/i })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(newer);
  });

  it('shows a not-found page for unknown addresses', () => {
    saveDemoDataBeforeLoad();
    renderApp('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('saves a new transaction in the browser, and it is still there after a reload', () => {
    saveDemoDataBeforeLoad();
    const { unmount } = renderApp('/transactions');

    clickButton('Add transaction');
    const form = screen.getByRole('form', { name: 'Add transaction' });
    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Persistence check' } });
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '9.99' } });
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'cat-groceries' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save transaction' }));

    expect(screen.getByText('Transaction added.')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Persistence check');

    unmount();
    renderApp('/transactions');
    expect(screen.getByText('Persistence check')).toBeInTheDocument();
  });
});