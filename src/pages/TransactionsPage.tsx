import { useLoadedData } from '../hooks/useAppData';
import TransactionBrowser from '../features/transactions/TransactionBrowser';

export default function TransactionsPage() {
  return <TransactionBrowser data={useLoadedData()} />;
}