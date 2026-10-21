# Accounting rules

These rules are implemented in `src/features/dashboard/calculations.ts` and
`src/types/finance.ts`, and are covered by tests.

## Money
- Amounts are stored as integer cents. Text such as "$1,234.50" is converted
  at the input boundary and formatted only for display.
- A transaction's `amountCents` is always positive. The `type` gives the direction.

## Transaction types
- **income**: money entering an account.
- **expense**: money leaving an account for spending.
- **transfer**: money moving between two of the user's own accounts. It is a
  single record with a source account (`accountId`) and a destination
  (`toAccountId`), and it has no category.

## What counts as what
- Income totals use `income` transactions only.
- Spending, category totals and budgets use `expense` transactions only.
- Net cash flow = income - expenses.
- Transfers never change income, spending or net cash flow, so moving money
  between accounts is not counted as new income or as an expense.

## Account balances
- Balance = opening balance + income - expenses - transfers out + transfers in,
  using transactions dated on or before the "as of" date.
- Balances are calculated from recorded data. They are estimates, not bank-reported balances.
- A transfer lowers one account and raises another by the same amount, so the
  total across all accounts is unchanged by transfers.

## Savings goals
- A savings contribution is a transfer with a `goalId` (for example, checking to savings).
- A goal's saved amount = `initialSavedCents` + the sum of transfers linked to
  that goal. It is never stored separately, so a contribution cannot be counted twice.
- A contribution is never an expense and never new income.