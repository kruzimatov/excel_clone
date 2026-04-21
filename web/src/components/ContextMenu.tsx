import { CELL_COLORS, CURRENCIES, type Currency } from '../types';
import { classNames } from '../utils/classNames';
import { getDynamicClassName } from '../utils/dynamicStyles';

import styles from './ContextMenu.module.css';

interface ContextMenuProps {
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
  onClear,
}: ContextMenuProps) {
  if (!visible) return null;

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
          <MenuItem icon="📋" label="Copy" onPress={() => { onCopy(); onClose(); }} />
          <MenuItem icon="✂️" label="Cut" onPress={() => { onCut(); onClose(); }} />
          {hasClipboard ? (
            <>
              <MenuItem icon="📄" label="Paste" onPress={() => { onPaste('all'); onClose(); }} />
              <MenuItem icon="🔢" label="Paste value only" onPress={() => { onPaste('value'); onClose(); }} />
              <MenuItem icon="🎨" label="Paste style only" onPress={() => { onPaste('style'); onClose(); }} />
            </>
          ) : null}

          <div className={styles.divider} />

          {!hasFormatPainter ? (
            <MenuItem
              icon="🖌️"
              label="Copy format"
              subtitle="Then select cells & apply"
              onPress={() => { onFormatPainterPick(); onClose(); }}
            />
          ) : (
            <MenuItem
              icon="✅"
              label="Apply format here"
              onPress={() => { onFormatPainterApply(); onClose(); }}
              highlight
            />
          )}

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>Formulas</div>
          {FORMULAS.map((formula) => (
            <MenuItem
              key={formula.key}
              icon={formula.icon}
              label={formula.label}
              onPress={() => { onFormula(formula.key); onClose(); }}
            />
          ))}

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>Fill Color</div>
          <div className={styles.colorRow}>
            {CELL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={classNames(
                  styles.colorDot,
                  getDynamicClassName('context-color', { backgroundColor: color }),
                )}
                onClick={() => { onColor(color); onClose(); }}
              />
            ))}
          </div>

          <div className={styles.divider} />

          <div className={styles.sectionTitle}>Currency</div>
          <div className={styles.currencyRow}>
            {CURRENCIES.map((currency) => (
              <button
                key={currency.key}
                type="button"
                className={styles.currencyButton}
                onClick={() => { onCurrency(currency.key); onClose(); }}
              >
                {currency.symbol}
              </button>
            ))}
          </div>

          <div className={styles.divider} />

          <MenuItem
            icon="🗑️"
            label="Clear cells"
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
