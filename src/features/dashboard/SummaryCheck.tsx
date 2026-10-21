import type { AppData } from '../../types/finance';
import type { IsoDate } from '../../types/primitives';
import { formatCents } from '../../utils/money';
import { calculateAccountBalances, summarizePeriod, totalBalanceCents } from './calculations';
import { presetRange } from './periods';

interface SummaryCheckProps {
  data: AppData;
  today: IsoDate;
}

// Temporary view for checking the calculations. The real dashboard replaces it.
export default function SummaryCheck({ data, today }: SummaryCheckProps) {
  const periods = [
    { label: 'This month', range: presetRange('this-month', today) },
    { label: 'Last month', range: presetRange('last-month', today) },
  ];
  const balances = calculateAccountBalances(data.accounts, data.transactions, today);

  return (
    <section>
      <h2>Calculation check</h2>
      <div className="setup-check__table-wrap">
        <table>
          <caption>Totals by period. Transfers are not income or spending.</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
              <th scope="col">Net</th>
              <th scope="col">Transfers</th>
              <th scope="col">To goals</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(({ label, range }) => {
              const summary = summarizePeriod(data.transactions, range);
              return (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{formatCents(summary.incomeCents)}</td>
                  <td>{formatCents(summary.expenseCents)}</td>
                  <td>{formatCents(summary.netCents)}</td>
                  <td>{formatCents(summary.transfersCents)}</td>
                  <td>{formatCents(summary.savingsContributionsCents)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Calculated balances</h3>
      <p className="setup-check__note">
        Opening balance plus recorded transactions up to today. Not a bank-reported balance.
      </p>
      <dl>
        {balances.map((balance) => (
          <div key={balance.accountId}>
            <dt>{balance.name}</dt>
            <dd>{formatCents(balance.balanceCents)}</dd>
          </div>
        ))}
        <div>
          <dt>Total</dt>
          <dd>{formatCents(totalBalanceCents(balances))}</dd>
        </div>
      </dl>
    </section>
  );
}