import { CELL_COLORS, CURRENCIES, type Currency } from '../types';
import { classNames } from '../utils/classNames';
import { getDynamicClassName } from '../utils/dynamicStyles';
import {
  getCurrencyLabel,
  getFillColorOptions,
  t,
  type AppLanguage,
} from '../utils/i18n';

import styles from './ContextMenu.module.css';

interface ContextMenuProps {
  language: AppLanguage;
  visible: boolean;
  position: { x: number; y: number };
  hasClipboard: boolean;
  hasFormatPainter: boolean;
  onClose: () => void;
  onFormula: (type: string) => void;
  onColor: (color: string) => void;
  onCurrency: (currency: Currency) => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: (mode: 'all' | 'value' | 'style') => void;
  onFormatPainterPick: () => void;
  onFormatPainterApply: () => void;
  deleteRowsLabel?: string | null;
  onDeleteRows?: () => void;
  onClear: () => void;
}

const FORMULAS = [
  { key: 'SUM', label: 'SUM (Сумма)', icon: 'Σ' },
  { key: 'AVERAGE', label: 'AVERAGE (Среднее)', icon: 'x̄' },
  { key: 'MIN', label: 'MIN (Минимум)', icon: '↓' },
  { key: 'MAX', label: 'MAX (Максимум)', icon: '↑' },
  { key: 'COUNT', label: 'COUNT (Кол-во)', icon: '#' },
];

export function ContextMenu({
  language,
  visible,
  position,
  hasClipboard,
  hasFormatPainter,
  onClose,
  onFormula,
  onColor,
  onCurrency,
  onCopy,
  onCut,
  onPaste,
  onFormatPainterPick,
  onFormatPainterApply,
  deleteRowsLabel,
  onDeleteRows,
  onClear,
}: ContextMenuProps) {
  if (!visible) return null;

  const fillOptions = getFillColorOptions(language, CELL_COLORS);

  const menuWidth = 260;
  const menuHeight = 500;
  const left = Math.max(10, Math.min(position.x, window.innerWidth - menuWidth - 10));
  const top = Math.max(10, Math.min(position.y, window.innerHeight - menuHeight - 18));
  const positionClass = getDynamicClassName('context-menu', {
    left: `${left}px`,
    top: `${top}px`,
    maxHeight: `${window.innerHeight - 24}px`,
  });

  return (
    <div className={styles.overlay} onClick={onClose} onContextMenu={(event) => event.preventDefault()}>
      <div
        className={classNames(styles.menu, positionClass)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.scrollArea}>
          <MenuItem icon="📋" label={t(language, 'copy')} onPress={() => { onCopy(); onClose(); }} />
          <MenuItem icon="✂️" label={t(language, 'cut')} onPress={() => { onCut(); onClose(); }} />
          {hasClipboard ? (
            <>
              <MenuItem icon="📄" label={t(language, 'paste')} onPress={() => { onPaste('all'); onClose(); }} />
              <MenuItem icon="🔢" label={t(language, 'pasteValueOnly')} onPress={() => { onPaste('value'); onClose(); }} />
              <MenuItem icon="🎨" label={t(language, 'pasteStyleOnly')} onPress={() => { onPaste('style'); onClose(); }} />
            </>
          ) : null}

          <div className={styles.divider} />

          {!hasFormatPainter ? (
            <MenuItem
              icon="🖌️"
              label={t(language, 'copyFormat')}
              subtitle={t(language, 'copyFormatHint')}
              onPress={() => { onFormatPainterPick(); onClose(); }}
            />
          ) : (
            <MenuItem
              icon="✅"
              label={t(language, 'applyFormatHere')}
              onPress={() => { onFormatPainterApply(); onClose(); }}
              highlight
            />
          )}

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>{t(language, 'formulas')}</div>
          {FORMULAS.map((formula) => (
            <MenuItem
              key={formula.key}
              icon={formula.icon}
              label={formula.label}
              onPress={() => { onFormula(formula.key); onClose(); }}
            />
          ))}

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>{t(language, 'fillColor')}</div>
          <div className={styles.colorRow}>
            {fillOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={classNames(
                  styles.colorDot,
                  getDynamicClassName('context-color', { backgroundColor: option.value }),
                )}
                title={option.label}
                onClick={() => { onColor(option.value); onClose(); }}
              />
            ))}
          </div>

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>{t(language, 'currency')}</div>
          <div className={styles.currencyRow}>
            {CURRENCIES.map((currency) => (
              <button
                key={currency.key}
                type="button"
                className={styles.currencyButton}
                title={getCurrencyLabel(language, currency.key)}
                onClick={() => { onCurrency(currency.key); onClose(); }}
              >
                {currency.symbol}
              </button>
            ))}
          </div>

          <div className={styles.divider} />

          {onDeleteRows && deleteRowsLabel ? (
            <>
              <MenuItem
                icon="🗑️"
                label={deleteRowsLabel}
                onPress={() => { onDeleteRows(); onClose(); }}
                destructive
              />
              <div className={styles.divider} />
            </>
          ) : null}

          <MenuItem
            icon="🗑️"
            label={t(language, 'clearCells')}
            onPress={() => { onClear(); onClose(); }}
            destructive
          />
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
  highlight,
  destructive,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  highlight?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      className={classNames(styles.menuItem, highlight && styles.menuItemHighlight)}
      onClick={onPress}
    >
      <span className={styles.menuIcon}>{icon}</span>
      <span className={styles.menuLabelWrap}>
        <span className={classNames(
          styles.menuLabel,
          destructive && styles.menuLabelDanger,
          highlight && styles.menuLabelHighlight,
        )}
        >
          {label}
        </span>
        {subtitle ? <span className={styles.menuSubtitle}>{subtitle}</span> : null}
      </span>
    </button>
  );
}
