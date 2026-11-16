import AccountManager from '../features/accounts/AccountManager';
import CategorizationInfo from '../features/categorization/CategorizationInfo';
import RuleManager from '../features/categorization/RuleManager';
import CategoryManager from '../features/categories/CategoryManager';
import { useAppData, useLoadedData } from '../hooks/useAppData';
import { todayIso } from '../utils/dates';

export default function ManagePage() {
  const data = useLoadedData();
  const { updateData } = useAppData();

  return (
    <div className="stack">
      <h1>Accounts and Categories</h1>
      <AccountManager data={data} today={todayIso()} onChange={updateData} />
      <CategoryManager data={data} onChange={updateData} />
      <RuleManager data={data} onChange={updateData} />
      <CategorizationInfo categories={data.categories} />
    </div>
  );
}