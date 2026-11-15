import type { Category } from '../../types/finance';

export interface KeywordRule {
  keyword: string;
  categoryId: string;
}

export interface CategorySuggestion {
  categoryId: string;
  keyword: string; // the (normalized) keyword that matched, so the UI can explain itself
}

export type Categorizer = (text: string, type: 'income' | 'expense') => CategorySuggestion | null;

// Lowercase, drop accents, and turn every run of other characters into a
// single space, so punctuation and capitals never affect matching.
//   "Trader Joe's #442"  ->  "trader joe s 442"
//   "CAFÉ  Luna"         ->  "cafe luna"
export function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface PreparedRule {
  keyword: string;
  paddedKeyword: string;
  categoryId: string;
  kind: Category['kind'];
}

// Builds a categorizer. The preparation work (normalizing keywords, looking
// up category kinds) is done once here, so categorizing thousands of imported
// rows later only pays for the matching itself.
//
// The rules:
//  - A keyword matches only as whole words. Padding both texts with spaces
//    makes " rent " match "Rent payment" but not "Car rental".
//  - Only categories of the right kind are considered: an expense never gets
//    an income category.
//  - Rules pointing at a category that no longer exists are skipped.
//  - If several keywords match, the longest wins (it is the most specific:
//    "uber eats" beats "uber"). On a tie, the earlier rule wins.
export function createCategorizer(categories: readonly Category[], rules: readonly KeywordRule[]): Categorizer {
  const kindById = new Map(categories.map((category) => [category.id, category.kind]));

  const prepared: PreparedRule[] = [];
  for (const rule of rules) {
    const keyword = normalizeForMatching(rule.keyword);
    const kind = kindById.get(rule.categoryId);
    if (keyword === '' || kind === undefined) {
      continue;
    }
    prepared.push({ keyword, paddedKeyword: ` ${keyword} `, categoryId: rule.categoryId, kind });
  }

  return (text, type) => {
    const paddedText = ` ${normalizeForMatching(text)} `;
    let best: PreparedRule | null = null;

    for (const rule of prepared) {
      if (rule.kind !== type || !paddedText.includes(rule.paddedKeyword)) {
        continue;
      }
      if (best === null || rule.keyword.length > best.keyword.length) {
        best = rule;
      }
    }

    return best === null ? null : { categoryId: best.categoryId, keyword: best.keyword };
  };
}