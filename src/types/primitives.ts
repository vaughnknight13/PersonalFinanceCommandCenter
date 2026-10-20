// Money is always stored as a whole number of cents ($12.34 -> 1234).
// Integers avoid floating-point errors such as 0.1 + 0.2 !== 0.3.
export type Cents = number;

// A calendar date written "YYYY-MM-DD" with no time and no time zone.
export type IsoDate = string;