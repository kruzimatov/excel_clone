import type { AppLanguage } from '../utils/i18n';
import { classNames } from '../utils/classNames';

import styles from './LanguageToggle.module.css';

interface LanguageToggleProps {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  tone?: 'light' | 'dark';
}

export function LanguageToggle({
  language,
  onChange,
  tone = 'light',
}: LanguageToggleProps) {
  return (
    <div className={classNames(styles.wrap, tone === 'dark' && styles.wrapDark)}>
      <button
        type="button"
        className={classNames(
          styles.button,
          tone === 'dark' && styles.buttonDark,
          language === 'uz' && styles.buttonActive,
          tone === 'dark' && language === 'uz' && styles.buttonActiveDark,
        )}
        onClick={() => onChange('uz')}
      >
        O'z
      </button>
      <button
        type="button"
        className={classNames(
          styles.button,
          tone === 'dark' && styles.buttonDark,
          language === 'ru' && styles.buttonActive,
          tone === 'dark' && language === 'ru' && styles.buttonActiveDark,
        )}
        onClick={() => onChange('ru')}
      >
        Рус
      </button>
    </div>
  );
}

