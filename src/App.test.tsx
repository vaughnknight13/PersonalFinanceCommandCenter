import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { BACKUP_KEY, STORAGE_KEY } from './services/storage';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the page heading', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /personal finance command center/i }),
    ).toBeInTheDocument();
  });

  it('starts empty before any data is saved', () => {
    render(<App />);
    expect(screen.getByText('Status: No saved data yet')).toBeInTheDocument();
  });

  it('loads demo data and saves it to the browser', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo data' }));

    expect(screen.getByText('Status: Demo data loaded')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Calculation check' })).toBeInTheDocument();
  });

  it('asks for confirmation before replacing existing data', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo data' }));
    const savedBefore = window.localStorage.getItem(STORAGE_KEY);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo data' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(savedBefore);
  });

  it('clears all data only after confirmation', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo data' }));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    expect(screen.getByText('Status: Demo data loaded')).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    expect(screen.getByText('Status: No saved data yet')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('protects damaged data and lets the user move it aside', () => {
    window.localStorage.setItem(STORAGE_KEY, '{oops');
    render(<App />);

    expect(screen.getByText('Status: Saved data is damaged')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load demo data' })).toBeDisabled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{oops');

    fireEvent.click(screen.getByRole('button', { name: 'Move damaged data aside' }));

    expect(screen.getByText('Status: No saved data yet')).toBeInTheDocument();
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe('{oops');
  });
});