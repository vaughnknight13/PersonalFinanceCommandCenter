import { createContext } from 'react';
import type { LoadResult,  StorageActionResult } from '../services/storage';
import type { AppData } from '../types/finance';

export interface AppDataStore {
  loadResult: LoadResult;
  data: AppData | null; // null unless loadResult.status is "loaded"
  message: string; // the last storage error, or '' when there is none
  loadDemoData(): void;
  startFresh(): void;
  clearEverything(): void;
  moveDamagedDataAside(): void;
  // Applies a pure change to the loaded data and saves the result in one write.
  updateData(transform: (data: AppData) => AppData): StorageActionResult;
}

export const AppDataContext = createContext<AppDataStore | null>(null);