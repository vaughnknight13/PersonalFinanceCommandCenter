import type { KeywordRule } from './categorizer';

function rulesFor(categoryId: string, keywords: readonly string[]): KeywordRule[] {
  return keywords.map((keyword) => ({ keyword, categoryId }));
}

// Built-in rules. Keywords are lowercase words separated by single spaces and
// match whole words only. These are starting points: any keyword can be
// ambiguous (a "target" may not be a store), which is why the form only
// suggests a category and the user can always change it.
export const DEFAULT_KEYWORD_RULES: readonly KeywordRule[] = [
  ...rulesFor('cat-groceries', [
    'grocery', 'groceries', 'supermarket', 'market', 'kroger', 'safeway', 'trader joe',
    'whole foods', 'aldi', 'publix', 'wegmans', 'costco',
  ]),
  ...rulesFor('cat-dining', [
    'restaurant', 'bistro', 'cafe', 'coffee', 'pizza', 'burger', 'taco', 'sushi', 'diner',
    'grill', 'bakery', 'starbucks', 'chipotle', 'doordash', 'uber eats', 'grubhub',
  ]),
  ...rulesFor('cat-transportation', [
    'fuel', 'gas station', 'gasoline', 'shell', 'exxon', 'chevron', 'sunoco', 'uber', 'lyft',
    'parking', 'toll', 'transit',
  ]),
  ...rulesFor('cat-utilities', [
    'electric', 'electricity', 'power', 'water bill', 'sewer', 'internet', 'broadband',
    'comcast', 'xfinity', 'verizon', 'utility', 'utilities',
  ]),
  ...rulesFor('cat-housing', ['rent', 'mortgage', 'hoa', 'landlord', 'apartments']),
  ...rulesFor('cat-subscriptions', [
    'subscription', 'netflix', 'spotify', 'hulu', 'disney plus', 'youtube premium', 'icloud',
    'dropbox', 'streambox', 'musicwave',
  ]),
  ...rulesFor('cat-insurance', ['insurance', 'geico', 'state farm', 'allstate', 'progressive']),
  ...rulesFor('cat-health', [
    'pharmacy', 'cvs', 'walgreens', 'doctor', 'dentist', 'dental', 'clinic', 'hospital', 'gym', 'fitness',
  ]),
  ...rulesFor('cat-shopping', [
    'amazon', 'target', 'walmart', 'best buy', 'home depot', 'lowes', 'ikea', 'household', 'clothing',
  ]),
  ...rulesFor('cat-entertainment', [
    'cinema', 'theater', 'theatre', 'movie', 'concert', 'ticketmaster', 'playstation', 'xbox',
    'museum', 'bowling',
  ]),
  ...rulesFor('cat-salary', ['payroll', 'paycheck', 'direct deposit', 'salary', 'wages']),
  ...rulesFor('cat-interest', ['interest', 'dividend']),
  ...rulesFor('cat-refunds', ['refund', 'returned', 'reimbursement', 'cashback', 'cash back']),
];