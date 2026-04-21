import type { FunctionMeta } from '../utils/functionMetadata';

import styles from './FunctionSuggestions.module.css';

interface FunctionSuggestionsProps {
  suggestions: FunctionMeta[];
  onSelect: (func: FunctionMeta) => void;
  visible: boolean;
}

export function FunctionSuggestions({
  suggestions,
  onSelect,
  visible,
}: FunctionSuggestionsProps) {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} role="listbox" aria-label="Function suggestions">
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
            <span className={styles.description}>{func.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
