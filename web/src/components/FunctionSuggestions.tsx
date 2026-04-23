import type { FunctionMeta } from '../utils/functionMetadata';
import { getFunctionDescription, t, type AppLanguage } from '../utils/i18n';

import styles from './FunctionSuggestions.module.css';

interface FunctionSuggestionsProps {
  language: AppLanguage;
  suggestions: FunctionMeta[];
  onSelect: (func: FunctionMeta) => void;
  visible: boolean;
}

export function FunctionSuggestions({
  language,
  suggestions,
  onSelect,
  visible,
}: FunctionSuggestionsProps) {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} role="listbox" aria-label={t(language, 'functionSuggestions')}>
      <div className={styles.scrollArea}>
        {suggestions.map((func) => (
          <button
            key={func.russianName}
            type="button"
            className={styles.item}
            onClick={() => onSelect(func)}
          >
            <span className={styles.name}>{func.russianName}</span>
            <span className={styles.syntax}>{func.syntax}</span>
            <span className={styles.description}>
              {getFunctionDescription(language, func.name, func.description)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
