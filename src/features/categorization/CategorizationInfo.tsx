import type { Category } from '../../types/finance';
import { DEFAULT_KEYWORD_RULES } from './defaultRules';

interface CategorizationInfoProps {
  categories: readonly Category[];
}

// Shows users exactly what the automatic categories are based on.
export default function CategorizationInfo({ categories }: CategorizationInfoProps) {
  const groups = categories
    .map((category) => ({
      category,
      keywords: DEFAULT_KEYWORD_RULES.filter((rule) => rule.categoryId === category.id).map((rule) => rule.keyword),
    }))
    .filter((group) => group.keywords.length > 0);

  return (
    <section className="card stack" aria-labelledby="categorization-heading">
      <h2 id="categorization-heading">How automatic categories work</h2>
      <p>
        While you type a description or merchant, the transaction form looks for keywords and fills in the matching
        category. Your own rules are checked first. If none of them match, the built-in keywords below are used.
        Keywords match whole words only, ignoring capital letters and punctuation. When several keywords of the same
        group match, the longest one wins. These are fixed rules, not machine learning, so the same text always gives
        the same suggestion. You can always choose a different category yourself.
      </p>
      <details>
        <summary>See the built-in keywords</summary>
        <dl className="keyword-list">
          {groups.map(({ category, keywords }) => (
            <div key={category.id}>
              <dt>{category.name}</dt>
              <dd>{keywords.join(', ')}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}