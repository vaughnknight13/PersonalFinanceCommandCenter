import { useContext } from 'react';
import { AppDataContext, type AppDataStore } from '../state/appDataContext';
import type { AppData } from '../types/finance';

export function useAppData(): AppDataStore {
  const store = useContext(AppDataContext);
  if (store === null) {
    throw new Error('useAppData must be used inside <AppDataProvider>.');
  }
  return store;
}

// For screens that sit behind the storage gate, where data always exists.
export function useLoadedData(): AppData {
  const { data } = useAppData();
  if (data === null) {
    throw new Error('useLoadedData was used before data finished loading.');
  }
  return data;
}