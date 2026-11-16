# Automatic categorization

## How it works
- The transaction form combines the description and merchant, normalizes the
  text (lowercase, accents removed, punctuation turned into spaces), and looks
  for built-in keywords.
- Keywords match **whole words only**: "rent" matches "Rent payment" but not
  "Car rental".
- Only categories of the right kind are considered: an expense never gets an
  income category.
- If several keywords match, the **longest** wins (it is the most specific:
  "uber eats" beats "uber"). On a tie, the earlier rule wins.
- Rules that point at a category the user has deleted are skipped.
- The suggestion fills the category until the user chooses one. A category the
  user chooses is never overwritten.

## What it is not
This is deterministic keyword matching. It is not machine learning, and it does
not learn. The same text always gives the same suggestion.

## Known limits
- Keywords can be ambiguous: "target" may not be a store, and "market" may not
  be a grocery store. The suggestion is a starting point.
- Text with no known keyword gets no suggestion.
- Descriptions in other languages, or with unusual abbreviations, will often
  not match.

## Ways to extend it
- User-defined rules, checked before the built-in ones (planned next).
- Remembering the category chosen for a merchant.
- Scoring several matches instead of choosing the longest keyword.
- A learned model, if a deterministic baseline stops being enough. The
  `Categorizer` function type is the seam where it would plug in.

## Your own rules
- Rules written by the user live in the saved data (`categoryRules`) and are
  checked **before** the built-in rules, as a separate group. If any of your
  rules match, the built-in rules are not consulted. This is deliberate: merging
  the two lists would let a longer built-in keyword beat a shorter rule of yours.
- Within your rules, the same matching logic applies (whole words, longest
  keyword wins).
- Two rules cannot have the same keyword after normalization ("Maple & Main"
  and "maple main" count as the same), because the result would depend on order.
- Deleting a category deletes the rules that point at it.