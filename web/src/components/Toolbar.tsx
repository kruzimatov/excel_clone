import { useState, type ReactNode } from 'react';

import { CELL_COLORS, CURRENCIES, type Currency } from '../types';
import { classNames } from '../utils/classNames';
import { getDynamicClassName } from '../utils/dynamicStyles';
import { filterFunctions, type FunctionMeta } from '../utils/functionMetadata';

import { FunctionSuggestions } from './FunctionSuggestions';
import styles from './Toolbar.module.css';

type ActiveMenu = 'fill' | 'text' | 'currency' | null;

const FILL_OPTIONS = [
  { value: CELL_COLORS[0], label: 'White' },
  { value: CELL_COLORS[1], label: 'Mint' },
  { value: CELL_COLORS[2], label: 'Green' },
  { value: CELL_COLORS[3], label: 'Sky' },
  { value: CELL_COLORS[4], label: 'Rose' },
  { value: CELL_COLORS[5], label: 'Yellow' },
  { value: CELL_COLORS[6], label: 'Blue' },
  { value: CELL_COLORS[7], label: 'Sage' },
  { value: CELL_COLORS[8], label: 'Peach' },
  { value: CELL_COLORS[9], label: 'Gray' },
];

const TEXT_COLOR_OPTIONS = [
  { value: '#000000', label: 'Black' },
  { value: '#CC0000', label: 'Red' },
  { value: '#006600', label: 'Green' },
  { value: '#0000CC', label: 'Blue' },
  { value: '#993399', label: 'Purple' },
  { value: '#CC6600', label: 'Orange' },
  { value: '#555555', label: 'Gray' },
  { value: '#FF0000', label: 'Bright red' },
  { value: '#00AA00', label: 'Bright green' },
  { value: '#3366FF', label: 'Accent blue' },
];

interface ToolbarProps {
  selectedCellRef: string;
  formulaInput: string;
  isBoldActive: boolean;
  isItalicActive: boolean;
  selectedFillColor: string;
  selectedTextColor: string;
  selectedCurrency: Currency;
  rangeSelectionActive: boolean;
  rangeSelectionLabel: string;
  rangeSelectionDetail: string;
  cellScalePercent: number;
  canDecreaseCellSize: boolean;
  canIncreaseCellSize: boolean;
  onFormulaChange: (text: string) => void;
  onFormulaFocus: () => void;
  onFormulaSubmit: () => void;
  onBoldPress: () => void;
  onItalicPress: () => void;
  onColorPress: (color: string) => void;
  onTextColorPress: (color: string) => void;
  onCurrencyPress: (currency: Currency) => void;
  onUndoPress: () => void;
  onRedoPress: () => void;
  onToggleRangeSelection: () => void;
  onDecreaseCellSize: () => void;
  onIncreaseCellSize: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar({
  selectedCellRef,
  formulaInput,
  isBoldActive,
  isItalicActive,
  selectedFillColor,
  selectedTextColor,
  selectedCurrency,
  rangeSelectionActive,
  rangeSelectionLabel,
  rangeSelectionDetail,
  cellScalePercent,
  canDecreaseCellSize,
  canIncreaseCellSize,
  onFormulaChange,
  onFormulaFocus,
  onFormulaSubmit,
  onBoldPress,
  onItalicPress,
  onColorPress,
  onTextColorPress,
  onCurrencyPress,
  onUndoPress,
  onRedoPress,
  onToggleRangeSelection,
  onDecreaseCellSize,
  onIncreaseCellSize,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [suggestions, setSuggestions] = useState<FunctionMeta[]>([]);
  const [showAllFunctions, setShowAllFunctions] = useState(false);

  const currentCurrency = CURRENCIES.find((item) => item.key === selectedCurrency) ?? null;
  const fillLabel = FILL_OPTIONS.find((option) => option.value === selectedFillColor)?.label ?? 'Custom';
  const textLabel = TEXT_COLOR_OPTIONS.find((option) => option.value === selectedTextColor)?.label ?? 'Custom';

  function handleFormulaChange(text: string) {
    if (text.startsWith('=')) {
      const afterEquals = text.substring(1);
      setSuggestions(filterFunctions(afterEquals));
      setShowAllFunctions(afterEquals.length === 0);
    } else {
      setSuggestions([]);
      setShowAllFunctions(false);
    }

    onFormulaChange(text);
  }

  function handleFunctionSelect(func: FunctionMeta) {
    onFormulaChange(`=${func.russianName}()`);
    setSuggestions([]);
    setShowAllFunctions(false);
  }

  function handleOpenFunctions() {
    setShowAllFunctions(true);
    setSuggestions(filterFunctions(''));
    onFormulaFocus();
  }

  function toggleMenu(menu: Exclude<ActiveMenu, null>) {
    setActiveMenu((current) => (current === menu ? null : menu));
  }

  return (
    <section className={styles.container}>
      <div className={styles.toolRow}>
        <div className={styles.groupCard}>
          <ActionChip
            icon="[]"
            label={rangeSelectionLabel}
            detail={rangeSelectionDetail}
            onPress={onToggleRangeSelection}
            active={rangeSelectionActive}
          />
        </div>

        <div className={styles.groupCard}>
          <ActionChip
            icon="-"
            label="Cells"
            detail={`${cellScalePercent}%`}
            onPress={onDecreaseCellSize}
            disabled={!canDecreaseCellSize}
          />
          <ActionChip
            icon="+"
            label="Cells"
            detail="Bigger"
            onPress={onIncreaseCellSize}
            disabled={!canIncreaseCellSize}
          />
        </div>

        <div className={styles.groupCard}>
          <ActionChip icon="↶" label="Undo" onPress={onUndoPress} disabled={!canUndo} />
          <ActionChip icon="↷" label="Redo" onPress={onRedoPress} disabled={!canRedo} />
        </div>

        <div className={styles.groupCard}>
          <ActionChip
            icon="B"
            label="Bold"
            onPress={onBoldPress}
            active={isBoldActive}
            emphasis="bold"
          />
          <ActionChip
            icon="I"
            label="Italic"
            onPress={onItalicPress}
            active={isItalicActive}
            emphasis="italic"
          />
        </div>

        <div className={styles.groupCard}>
          <ActionChip
            label="Fill"
            detail={fillLabel}
            onPress={() => toggleMenu('fill')}
            active={activeMenu === 'fill'}
            dropdown
            swatchColor={selectedFillColor}
          />
          <ActionChip
            icon="A"
            label="Text"
            detail={textLabel}
            onPress={() => toggleMenu('text')}
            active={activeMenu === 'text'}
            dropdown
            iconColor={selectedTextColor}
          />
          <ActionChip
            icon={currentCurrency?.symbol ?? '123'}
            label="Currency"
            detail={currentCurrency?.label ?? 'Plain number'}
            onPress={() => toggleMenu('currency')}
            active={activeMenu === 'currency'}
            dropdown
          />
        </div>
      </div>

      <div className={styles.formulaBar}>
        <div className={styles.cellRefBox}>{selectedCellRef}</div>
        <div className={styles.fxBadge}>fx</div>
        <button type="button" className={styles.functionButton} onClick={handleOpenFunctions}>
          ƒ
        </button>
        <input
          className={styles.formulaInput}
          value={formulaInput}
          onChange={(event) => handleFormulaChange(event.target.value)}
          onFocus={onFormulaFocus}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onFormulaSubmit();
            }
          }}
          placeholder="Type value or =СУММ"
          spellCheck={false}
        />
        {formulaInput.length > 0 ? (
          <button type="button" className={styles.submitButton} onClick={onFormulaSubmit}>
            ✓
          </button>
        ) : null}
      </div>

      <FunctionSuggestions
        suggestions={suggestions}
        onSelect={handleFunctionSelect}
        visible={suggestions.length > 0 || showAllFunctions}
      />

      {activeMenu === 'fill' ? (
        <PickerCard title="Fill color" onClose={() => setActiveMenu(null)}>
          <div className={styles.colorGrid}>
            {FILL_OPTIONS.map((option) => (
              <ColorOption
                key={option.value}
                label={option.label}
                color={option.value}
                selected={selectedFillColor === option.value}
                onPress={() => {
                  onColorPress(option.value);
                  setActiveMenu(null);
                }}
              />
            ))}
          </div>
        </PickerCard>
      ) : null}

      {activeMenu === 'text' ? (
        <PickerCard title="Text color" onClose={() => setActiveMenu(null)}>
          <div className={styles.colorGrid}>
            {TEXT_COLOR_OPTIONS.map((option) => (
              <ColorOption
                key={option.value}
                label={option.label}
                color={option.value}
                selected={selectedTextColor === option.value}
                onPress={() => {
                  onTextColorPress(option.value);
                  setActiveMenu(null);
                }}
              />
            ))}
          </div>
        </PickerCard>
      ) : null}

      {activeMenu === 'currency' ? (
        <PickerCard title="Currency format" onClose={() => setActiveMenu(null)}>
          <div className={styles.listOptions}>
            {[...CURRENCIES, { key: '', symbol: '123', label: 'Plain number' }].map((currency) => (
              <button
                key={currency.key || 'plain'}
                type="button"
                className={classNames(
                  styles.listOption,
                  selectedCurrency === currency.key && styles.listOptionActive,
                )}
                onClick={() => {
                  onCurrencyPress(currency.key as Currency);
                  setActiveMenu(null);
                }}
              >
                <span className={styles.listIconWrap}>{currency.symbol}</span>
                <span className={styles.listTextWrap}>
                  <span className={styles.listLabel}>{currency.label}</span>
                  <span className={styles.listHint}>
                    {currency.key
                      ? `Format values as ${currency.symbol}`
                      : 'Keep numbers without a currency sign'}
                  </span>
                </span>
                {selectedCurrency === currency.key ? <span className={styles.listCheck}>✓</span> : null}
              </button>
            ))}
          </div>
        </PickerCard>
      ) : null}
    </section>
  );
}

function ActionChip({
  icon,
  label,
  detail,
  onPress,
  disabled,
  active,
  dropdown,
  emphasis,
  swatchColor,
  iconColor,
}: {
  icon?: string;
  label: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  dropdown?: boolean;
  emphasis?: 'bold' | 'italic';
  swatchColor?: string;
  iconColor?: string;
}) {
  const swatchClass = swatchColor
    ? getDynamicClassName('toolbar-swatch', { backgroundColor: swatchColor })
    : '';
  const iconClass = iconColor
    ? getDynamicClassName('toolbar-icon', { color: iconColor })
    : '';

  return (
    <button
      type="button"
      className={classNames(
        styles.actionChip,
        disabled && styles.actionChipDisabled,
        active && styles.actionChipActive,
      )}
      onClick={onPress}
      disabled={disabled}
    >
      <span className={styles.actionMain}>
        {swatchColor ? (
          <span className={classNames(styles.swatchPreview, swatchClass)} />
        ) : (
          <span
            className={classNames(
              styles.actionIcon,
              emphasis === 'bold' && styles.actionIconBold,
              emphasis === 'italic' && styles.actionIconItalic,
              active && styles.actionIconActive,
              disabled && styles.actionIconDisabled,
              iconClass,
            )}
          >
            {icon}
          </span>
        )}
        <span className={styles.actionTextWrap}>
          <span className={classNames(styles.actionLabel, active && styles.actionLabelActive)}>
            {label}
          </span>
          {detail ? (
            <span className={classNames(styles.actionDetail, active && styles.actionDetailActive)}>
              {detail}
            </span>
          ) : null}
        </span>
      </span>
      {dropdown ? <span className={classNames(styles.actionChevron, active && styles.actionChevronActive)}>▾</span> : null}
    </button>
  );
}

function PickerCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.pickerCard}>
      <div className={styles.pickerHeader}>
        <span className={styles.pickerTitle}>{title}</span>
        <button type="button" className={styles.doneButton} onClick={onClose}>
          Done
        </button>
      </div>
      {children}
    </div>
  );
}

function ColorOption({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const swatchClass = getDynamicClassName('picker-color', { backgroundColor: color });

  return (
    <button
      type="button"
      className={classNames(styles.colorOption, selected && styles.colorOptionActive)}
      onClick={onPress}
    >
      <span className={styles.colorTopRow}>
        <span className={classNames(styles.colorSwatch, swatchClass)} />
        {selected ? <span className={styles.colorCheck}>✓</span> : null}
      </span>
      <span className={classNames(styles.colorLabel, selected && styles.colorLabelActive)}>
        {label}
      </span>
    </button>
  );
}
