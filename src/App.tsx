import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import StorageGate from './components/StorageGate';
import DashboardPage from './pages/DashboardPage';
import ManagePage from './pages/ManagePage';
import NotFoundPage from './pages/NotFoundPage';
import SettingsPage from './pages/SettingsPage';
import TransactionsPage from './pages/TransactionsPage';
import AppDataProvider from './state/AppDataProvider';

// The router is supplied from outside (HashRouter in main.tsx, MemoryRouter in tests).
export default function App() {
  return (
    <AppDataProvider>
      <StorageGate>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="manage" element={<ManagePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </StorageGate>
    </AppDataProvider>
  );
}