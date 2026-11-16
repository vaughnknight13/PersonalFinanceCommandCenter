import { useMemo, useState } from 'react';
import type { AppData } from '../../types/finance';
import { createCategorizerWithUserRules } from './categorizer';
import { DEFAULT_KEYWORD_RULES } from './defaultRules';

interface RuleTesterProps {
  data: AppData;
}

// Lets the user type a description and see what the rules would suggest,
// and which keyword decided it. Nothing here changes any data.
export default function RuleTester({ data }: RuleTesterProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');

  const categorize = useMemo(
    () => createCategorizerWithUserRules(data.categories, data.categoryRules, DEFAULT_KEYWORD_RULES),
    [data.categories, data.categoryRules],
  );

  function describeResult(): string {
    if (text.trim() === '') {
      return 'Type a description above to see which category the rules would suggest.';
    }
    const suggestion = categorize(text, type);
    if (suggestion === null) {
      return 'No suggestion: no rule matches this text.';
    }
    const categoryName =
      data.categories.find((category) => category.id === suggestion.categoryId)?.name ?? 'Unknown category';
    const origin = suggestion.source === 'yours' ? 'your rule' : 'built-in keyword';
    return `Suggested category: ${categoryName} (${origin} "${suggestion.keyword}")`;
  }

  return (
    <div className="form-panel stack">
      <h3>Try a description</h3>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tester-text">Description or merchant</label>
          <input
            id="tester-text"
            type="text"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tester-type">Type</label>
          <select
            id="tester-type"
            value={type}
            onChange={(event) => setType(event.target.value === 'income' ? 'income' : 'expense')}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
      </div>
      <p role="status">{describeResult()}</p>
    </div>
  );
}