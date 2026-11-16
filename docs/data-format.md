# Data format and migrations

All data is saved in the browser under one localStorage key, `pfcc:data`, as an
envelope:

    { "schemaVersion": 2, "savedAt": "<ISO timestamp>", "data": { ... } }

`schemaVersion` is the version of the shape of `data`. It lets a newer version
of the app read data saved by an older one.

## Versions

| Version | Change |
|---|---|
| 1 | First format: accounts, categories, transactions, budgets, recurring items, savings goals, `isDemo`. |
| 2 | Added `categoryRules` (the user's own keyword rules). |

## Loading, step by step
1. Read the envelope. Damaged or unrecognizable data is reported and left alone.
2. If `schemaVersion` is higher than this app understands, stop and leave the
   data untouched (it was saved by a newer version).
3. If it is lower, run the migrations in order (1 to 2, then 2 to 3, and so on).
4. Validate the result completely (shape and references between records).
5. Loading never writes. Upgraded data is only saved the next time the user
   changes something, and is then saved in the current version.

## Changing the format
1. Update the schema in `src/types/finance.ts`.
2. Add a function in `src/services/migrations.ts` that turns data in the old
   shape into the new shape.
3. Register it in the `migrations` map in `src/services/storage.ts` and raise
   `CURRENT_SCHEMA_VERSION`.
4. Update the demo data, the empty data and the test fixture.
5. Add a test that loads a saved envelope in the old format and checks the result.

Never edit an existing migration after it has shipped: someone may still have
data in that format.