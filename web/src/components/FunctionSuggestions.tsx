import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import type { FunctionMeta } from '../utils/functionMetadata';
import { getFunctionDescription, t, type AppLanguage } from '../utils/i18n';

import styles from './FunctionSuggestions.module.css';

interface FunctionSuggestionsProps {
  language: AppLanguage;
  suggestions: FunctionMeta[];
  onSelect: (func: FunctionMeta) => void;
  visible: boolean;
  anchorStyle?: CSSProperties;
}

export function FunctionSuggestions({
  language,
  suggestions,
  onSelect,
  visible,
  anchorStyle,
}: FunctionSuggestionsProps) {
  if (!visible || suggestions.length === 0 || !anchorStyle) {
    return null;
  }

  const content = (
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

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(
    <div className={styles.layer} style={anchorStyle}>
      {content}
    </div>,
    document.body,
  );
}
