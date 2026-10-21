import type { AppData, RecurringItem, Transaction } from '../types/finance';
import type { IsoDate } from '../types/primitives';
import { addDays, addMonthsClamped, startOfMonth } from '../utils/dates';
import { DEFAULT_CATEGORIES } from './defaultCategories';

// All demo people, businesses and amounts are fictional.
// The data is generated relative to "today" so the dashboard always looks
// current, and it uses arithmetic instead of random numbers, so the same
// date always produces exactly the same data (which makes it testable).

const CHECKING = 'acct-demo-checking';
const SAVINGS = 'acct-demo-savings';
const EMERGENCY_GOAL = 'goal-demo-emergency';
const TRIP_GOAL = 'goal-demo-trip';
const MONTHS_OF_HISTORY = 6;
const PAYCHECK_CENTS = 198_000;
const EMERGENCY_CONTRIBUTION_CENTS = 30_000;

interface MonthlyBill {
  slug: string;
  description: string;
  merchant: string;
  amountCents: number;
  categoryId: string;
  dayOfMonth: number; // always 28 or less, so it exists in every month
}

const MONTHLY_BILLS: readonly MonthlyBill[] = [
  { slug: 'rent', description: 'Rent', merchant: 'Cityview Apartments', amountCents: 145_000, categoryId: 'cat-housing', dayOfMonth: 1 },
  { slug: 'car-insurance', description: 'Car insurance', merchant: 'Harbor Insurance', amountCents: 12_800, categoryId: 'cat-insurance', dayOfMonth: 5 },
  { slug: 'streambox', description: 'StreamBox subscription', merchant: 'StreamBox', amountCents: 1_599, categoryId: 'cat-subscriptions', dayOfMonth: 8 },
  { slug: 'internet', description: 'Internet service', merchant: 'Brightline Internet', amountCents: 6_500, categoryId: 'cat-utilities', dayOfMonth: 15 },
  { slug: 'musicwave', description: 'MusicWave subscription', merchant: 'MusicWave', amountCents: 1_099, categoryId: 'cat-subscriptions', dayOfMonth: 20 },
  { slug: 'gym', description: 'Gym membership', merchant: 'Summit Fitness', amountCents: 3_900, categoryId: 'cat-health', dayOfMonth: 22 },
];

interface VariablePattern {
  description: string;
  merchant: string;
  categoryId: string;
  days: readonly number[];
  baseCents: number;
  swingCents: number;
}

const VARIABLE_PATTERNS: readonly VariablePattern[] = [
  { description: 'Grocery run', merchant: 'Greenfield Market', categoryId: 'cat-groceries', days: [4, 10, 17, 23, 28], baseCents: 6_200, swingCents: 3_400 },
  { description: 'Dinner out', merchant: 'Riverside Bistro', categoryId: 'cat-dining', days: [7, 14, 21, 26], baseCents: 3_400, swingCents: 3_000 },
  { description: 'Fuel', merchant: 'Fuel Stop', categoryId: 'cat-transportation', days: [6, 16, 25], baseCents: 3_800, swingCents: 1_500 },
  { description: 'Electric bill', merchant: 'Northwind Power & Light', categoryId: 'cat-utilities', days: [12], baseCents: 9_200, swingCents: 4_000 },
  { description: 'Household supplies', merchant: 'Maple & Main', categoryId: 'cat-shopping', days: [11, 24], baseCents: 2_800, swingCents: 6_000 },
  { description: 'Pharmacy', merchant: 'Corner Pharmacy', categoryId: 'cat-health', days: [19], baseCents: 1_800, swingCents: 2_200 },
];

// Repeatable "variation": the same inputs always give the same amount.
function variableAmount(pattern: VariablePattern, monthIndex: number, occurrence: number): number {
  const wobble = (monthIndex * 7919 + occurrence * 104729 + pattern.baseCents) % (pattern.swingCents + 1);
  return pattern.baseCents + wobble;
}

export function createDemoData(today: IsoDate): AppData {
  const windowStart = startOfMonth(addMonthsClamped(startOfMonth(today), -(MONTHS_OF_HISTORY - 1)));

  // Transactions are collected without ids, sorted by date, then numbered.
  const drafts: Omit<Transaction, 'id'>[] = [];
  function addDraft(draft: Omit<Transaction, 'id'>): void {
    if (draft.date <= today) {
      drafts.push(draft); // demo history never contains future-dated transactions
    }
  }

  // Paychecks every 14 days, counting back from a pay date one week ago.
  const payDates: IsoDate[] = [];
  let payDate = addDays(today, -7);
  while (payDate >= windowStart) {
    payDates.unshift(payDate);
    payDate = addDays(payDate, -14);
  }
  for (const date of payDates) {
    addDraft({
      date,
      description: 'Paycheck',
      merchant: 'Meridian Payroll',
      amountCents: PAYCHECK_CENTS,
      type: 'income',
      categoryId: 'cat-salary',
      accountId: CHECKING,
      recurringId: 'rec-demo-paycheck',
    });
  }

  for (let monthIndex = 0; monthIndex < MONTHS_OF_HISTORY; monthIndex++) {
    const monthStart = addMonthsClamped(windowStart, monthIndex);
    const dateOn = (dayOfMonth: number): IsoDate => addDays(monthStart, dayOfMonth - 1);

    for (const bill of MONTHLY_BILLS) {
      addDraft({
        date: dateOn(bill.dayOfMonth),
        description: bill.description,
        merchant: bill.merchant,
        amountCents: bill.amountCents,
        type: 'expense',
        categoryId: bill.categoryId,
        accountId: CHECKING,
        recurringId: `rec-demo-${bill.slug}`,
      });
    }

    // A savings contribution is a transfer: it moves money between accounts
    // and counts toward the goal, but it is not an expense and not income.
    addDraft({
      date: dateOn(3),
      description: 'Emergency fund contribution',
      amountCents: EMERGENCY_CONTRIBUTION_CENTS,
      type: 'transfer',
      categoryId: null,
      accountId: CHECKING,
      toAccountId: SAVINGS,
      goalId: EMERGENCY_GOAL,
      recurringId: 'rec-demo-emergency-fund',
    });

    addDraft({
      date: dateOn(28),
      description: 'Savings interest',
      amountCents: 1_100 + ((monthIndex * 37) % 400),
      type: 'income',
      categoryId: 'cat-interest',
      accountId: SAVINGS,
    });

    for (const pattern of VARIABLE_PATTERNS) {
      pattern.days.forEach((day, occurrence) => {
        addDraft({
          date: dateOn(day),
          description: pattern.description,
          merchant: pattern.merchant,
          amountCents: variableAmount(pattern, monthIndex, occurrence),
          type: 'expense',
          categoryId: pattern.categoryId,
          accountId: CHECKING,
        });
      });
    }

    if (monthIndex === 3) {
      addDraft({
        date: dateOn(18),
        description: 'Laptop repair',
        merchant: 'TechFix Repair',
        amountCents: 18_900,
        type: 'expense',
        categoryId: 'cat-other-expense',
        accountId: CHECKING,
        notes: 'One-time expense',
      });
    }
    if (monthIndex === 4) {
      addDraft({
        date: dateOn(9),
        description: 'Returned headphones',
        merchant: 'Maple & Main',
        amountCents: 5_999,
        type: 'income',
        categoryId: 'cat-refunds',
        accountId: CHECKING,
      });
    }
  }

  const sorted = [...drafts].sort((a, b) => a.date.localeCompare(b.date));
  const transactions: Transaction[] = sorted.map((draft, index) => ({
    ...draft,
    id: `demo-txn-${String(index + 1).padStart(4, '0')}`,
  }));

  const recurringItems: RecurringItem[] = [
    {
      id: 'rec-demo-paycheck',
      description: 'Paycheck',
      amountCents: PAYCHECK_CENTS,
      type: 'income',
      categoryId: 'cat-salary',
      accountId: CHECKING,
      frequency: 'biweekly',
      startDate: payDates[0] ?? windowStart,
      active: true,
    },
    ...MONTHLY_BILLS.map(
      (bill): RecurringItem => ({
        id: `rec-demo-${bill.slug}`,
        description: bill.description,
        amountCents: bill.amountCents,
        type: 'expense',
        categoryId: bill.categoryId,
        accountId: CHECKING,
        frequency: 'monthly',
        startDate: addDays(windowStart, bill.dayOfMonth - 1),
        active: true,
      }),
    ),
    {
      id: 'rec-demo-emergency-fund',
      description: 'Emergency fund contribution',
      amountCents: EMERGENCY_CONTRIBUTION_CENTS,
      type: 'transfer',
      categoryId: null,
      accountId: CHECKING,
      toAccountId: SAVINGS,
      goalId: EMERGENCY_GOAL,
      frequency: 'monthly',
      startDate: addDays(windowStart, 2),
      active: true,
    },
  ];

  return {
    isDemo: true,
    accounts: [
      { id: CHECKING, name: 'Everyday Checking', kind: 'checking', openingBalanceCents: 180_000 },
      { id: SAVINGS, name: 'High-Yield Savings', kind: 'savings', openingBalanceCents: 165_000 },
    ],
    categories: [...DEFAULT_CATEGORIES],
    transactions,
    budgets: [
      { categoryId: 'cat-groceries', monthlyLimitCents: 45_000 },
      { categoryId: 'cat-dining', monthlyLimitCents: 20_000 },
      { categoryId: 'cat-transportation', monthlyLimitCents: 16_000 },
      { categoryId: 'cat-subscriptions', monthlyLimitCents: 7_000 },
      { categoryId: 'cat-shopping', monthlyLimitCents: 15_000 },
      { categoryId: 'cat-utilities', monthlyLimitCents: 20_000 },
    ],
    recurringItems,
    savingsGoals: [
      {
        id: EMERGENCY_GOAL,
        name: 'Emergency fund',
        targetCents: 500_000,
        initialSavedCents: 120_000,
        targetDate: addMonthsClamped(today, 10),
        notes: 'About three months of essential expenses.',
      },
      {
        id: TRIP_GOAL,
        name: 'Summer trip',
        targetCents: 180_000,
        initialSavedCents: 45_000,
        targetDate: addMonthsClamped(today, 8),
      },
    ],
  };
}