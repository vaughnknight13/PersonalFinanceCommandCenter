import TransactionManager from '../features/transactions/TransactionManager';
import { useAppData, useLoadedData } from '../hooks/useAppData';
import { todayIso } from '../utils/dates';

export default function TransactionsPage() {
  const data = useLoadedData();
  const { updateData } = useAppData();
  return <TransactionManager data={data} today={todayIso()} onChange={updateData} />;
}