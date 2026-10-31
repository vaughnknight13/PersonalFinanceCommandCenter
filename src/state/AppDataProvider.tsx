import { useState, type ReactNode } from 'react';
import { createDemoData } from '../data/demoData';
import { createEmptyData } from '../data/emptyData';
import {
  clearAllData,
  loadAppData,
  quarantineStoredData,
  saveAppData,
  type LoadResult,
  type StorageActionResult,
} from '../services/storage';
import { todayIso } from '../utils/dates';
import { AppDataContext, type AppDataStore } from './appDataContext';

interface AppDataProviderProps {
  children: ReactNode;
}

export default function AppDataProvider({ children }: AppDataProviderProps) {
  const [loadResult, setLoadResult] = useState<LoadResult>(() => loadAppData());
  const [message, setMessage] = useState('');

  // Runs after every storage action. The screen is rebuilt from what storage
  // actually contains, so the UI can never show data that failed to save.
  function finish(result: StorageActionResult): void {
    setMessage(result.ok ? '' : result.error);
    setLoadResult(loadAppData());
  }

  const store: AppDataStore = {
    loadResult,
    data: loadResult.status === 'loaded' ? loadResult.data : null,
    message,
    loadDemoData: () => finish(saveAppData(createDemoData(todayIso()))),
    startFresh: () => finish(saveAppData(createEmptyData())),
    clearEverything: () => finish(clearAllData()),
    moveDamagedDataAside: () => finish(quarantineStoredData()),
  };

  return <AppDataContext.Provider value={store}>{children}</AppDataContext.Provider>;
}