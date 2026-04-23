import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

import { CELL_COLORS, CURRENCIES, type Currency } from '../types';
import { classNames } from '../utils/classNames';
import { getDynamicClassName } from '../utils/dynamicStyles';
import { filterFunctions, type FunctionMeta } from '../utils/functionMetadata';
import {
  getCurrencyHint,
  getCurrencyLabel,
  getFillColorOptions,
  getTextColorOptions,
  t,
  type AppLanguage,
} from '../utils/i18n';

import { FunctionSuggestions } from './FunctionSuggestions';
import styles from './Toolbar.module.css';

type ActiveMenu = 'fill' | 'text' | 'currency' | null;
type MenuPlacement = 'top' | 'bottom';
type ToolbarMode = 'all' | 'ribbon' | 'formula';

interface MenuAnchor {
  top: number;
  left: number;
  width: number;
  placement: MenuPlacement;
}

interface SuggestionsAnchor {
  style: CSSProperties;
}

const MENU_DIMENSIONS: Record<Exclude<ActiveMenu, null>, { width: number; height: number }> = {
  fill: { width: 296, height: 250 },
  text: { width: 296, height: 250 },
  currency: { width: 320, height: 320 },
};

interface ToolbarProps {
  mode?: ToolbarMode;
  language: AppLanguage;
  selectedCellRef: string;
  formulaInput: string;
  isBoldActive: boolean;
  isItalicActive: boolean;
  selectedFillColor: string;
  selectedTextColor: string;
  selectedCurrency: Currency;
  rangeSelectionActive: boolean;
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
  mode = 'all',
  language,
  selectedCellRef,
  formulaInput,
  isBoldActive,
  isItalicActive,
  selectedFillColor,
  selectedTextColor,
  selectedCurrency,
  rangeSelectionActive,
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
  const [menusOpen, setMenusOpen] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [suggestionsAnchor, setSuggestionsAnchor] = useState<SuggestionsAnchor | null>(null);
  const formulaFieldRef = useRef<HTMLDivElement | null>(null);

  const fillOptions = getFillColorOptions(language, CELL_COLORS);
  const textColorOptions = getTextColorOptions(language, [
    '#000000',
    '#CC0000',
    '#006600',
    '#0000CC',
    '#993399',
    '#CC6600',
    '#555555',
    '#FF0000',
    '#00AA00',
    '#3366FF',
  ]);
  const currentCurrency = CURRENCIES.find((item) => item.key === selectedCurrency) ?? null;
  const fillLabel = fillOptions.find((option) => option.value === selectedFillColor)?.label ?? t(language, 'custom');
  const textLabel = textColorOptions.find((option) => option.value === selectedTextColor)?.label ?? t(language, 'custom');

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

  useEffect(() => {
    const suggestionsVisible = suggestions.length > 0 || showAllFunctions;
    if (!suggestionsVisible) {
      setSuggestionsAnchor(null);
      return;
    }

    function updateSuggestionsAnchor() {
      const anchorElement = formulaFieldRef.current;
      if (!anchorElement) {
        setSuggestionsAnchor(null);
        return;
      }

      const rect = anchorElement.getBoundingClientRect();
      const margin = 12;
      const gap = 6;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(140, Math.min(280, openAbove ? spaceAbove - gap : spaceBelow - gap));

      setSuggestionsAnchor({
        style: openAbove
          ? {
              bottom: `${Math.max(margin, viewportHeight - rect.top + gap)}px`,
              left: `${Math.max(margin, rect.left)}px`,
              maxHeight: `${availableHeight}px`,
              width: `${Math.max(220, rect.width)}px`,
            }
          : {
              left: `${Math.max(margin, rect.left)}px`,
              maxHeight: `${availableHeight}px`,
              top: `${rect.bottom + gap}px`,
              width: `${Math.max(220, rect.width)}px`,
            },
      });
    }

    updateSuggestionsAnchor();
    window.addEventListener('resize', updateSuggestionsAnchor);
    window.addEventListener('scroll', updateSuggestionsAnchor, true);

    return () => {
      window.removeEventListener('resize', updateSuggestionsAnchor);
      window.removeEventListener('scroll', updateSuggestionsAnchor, true);
    };
  }, [showAllFunctions, suggestions]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(`.${styles.pickerCard}`) && !target?.closest(`.${styles.dropdownGroup}`)) {
        setActiveMenu(null);
        setMenuAnchor(null);
      }
    }

    function syncPopoverPosition() {
      if (!activeMenu) return;
      setActiveMenu(null);
      setMenuAnchor(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', syncPopoverPosition);
    window.addEventListener('scroll', syncPopoverPosition, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', syncPopoverPosition);
      window.removeEventListener('scroll', syncPopoverPosition, true);
    };
  }, [activeMenu]);

  function toggleMenu(menu: Exclude<ActiveMenu, null>, event: ReactMouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const dimensions = MENU_DIMENSIONS[menu];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const availableBelow = viewportHeight - rect.bottom - margin;
    const placement: MenuPlacement = availableBelow >= dimensions.height ? 'bottom' : 'top';
    const nextTop =
      placement === 'bottom'
        ? Math.min(viewportHeight - dimensions.height - margin, rect.bottom + 8)
        : Math.max(margin, rect.top - dimensions.height - 8);
    const desiredLeft = rect.left;
    const nextLeft = Math.max(
      margin,
      Math.min(desiredLeft, viewportWidth - dimensions.width - margin),
    );

    setActiveMenu((current) => {
      const nextValue = current === menu ? null : menu;
      setMenuAnchor(
        nextValue
          ? {
              top: nextTop,
              left: nextLeft,
              width: dimensions.width,
              placement,
            }
          : null,
      );
      return nextValue;
    });
  }

  return (
    <section className={classNames(
      styles.container,
      mode === 'ribbon' && styles.containerRibbon,
      mode === 'formula' && styles.containerFormula,
    )}
    >
      {mode !== 'formula' ? (
        <>
      <div className={classNames(styles.toolbarHeader, mode === 'ribbon' && styles.toolbarHeaderRibbon)}>
        <button
          type="button"
          className={styles.toolbarToggle}
          onClick={() => setMenusOpen((current) => !current)}
          aria-label={t(language, 'menu')}
          title={t(language, 'menu')}
        >
          {menusOpen ? '☰' : '☷'}
        </button>
      </div>

      <div className={classNames(
        styles.toolPanels,
        mode === 'ribbon' && styles.toolPanelsRibbon,
        !menusOpen && styles.toolPanelsClosed,
      )}
      >
        <div className={classNames(styles.toolRow, mode === 'ribbon' && styles.toolRowRibbon)}>
          <div className={styles.groupCard}>
            <ActionChip
              icon="▦"
              ariaLabel={`${t(language, 'range')}: ${rangeSelectionDetail}`}
              label={t(language, 'range')}
              onPress={onToggleRangeSelection}
              active={rangeSelectionActive}
              compact={mode !== 'ribbon'}
            />
          </div>

          <div className={styles.groupCard}>
            <ActionChip
              icon="-"
              ariaLabel={`${t(language, 'cells')} -`}
              title={`${t(language, 'cells')} - ${cellScalePercent}%`}
              onPress={onDecreaseCellSize}
              disabled={!canDecreaseCellSize}
              compact
            />
            <ActionChip
              icon="+"
              ariaLabel={`${t(language, 'cells')} +`}
              onPress={onIncreaseCellSize}
              disabled={!canIncreaseCellSize}
              compact
            />
          </div>

          <div className={styles.groupCard}>
            <ActionChip icon="↶" ariaLabel={t(language, 'undo')} onPress={onUndoPress} disabled={!canUndo} compact />
            <ActionChip icon="↷" ariaLabel={t(language, 'redo')} onPress={onRedoPress} disabled={!canRedo} compact />
          </div>

          <div className={styles.groupCard}>
            <ActionChip
              icon="B"
              ariaLabel={t(language, 'bold')}
              onPress={onBoldPress}
              active={isBoldActive}
              emphasis="bold"
              compact
            />
            <ActionChip
              icon="I"
              ariaLabel={t(language, 'italic')}
              onPress={onItalicPress}
              active={isItalicActive}
              emphasis="italic"
              compact
            />
          </div>

          <div className={classNames(styles.groupCard, styles.dropdownGroup)}>
            <ActionChip
              ariaLabel={`${t(language, 'fill')}: ${fillLabel}`}
              onPress={(event) => toggleMenu('fill', event)}
              active={activeMenu === 'fill'}
              dropdown
              swatchColor={selectedFillColor}
              compact
            />
            <ActionChip
              icon="A"
              ariaLabel={`${t(language, 'text')}: ${textLabel}`}
              onPress={(event) => toggleMenu('text', event)}
              active={activeMenu === 'text'}
              dropdown
              iconColor={selectedTextColor}
              compact
            />
            <ActionChip
              icon={currentCurrency?.symbol ?? '123'}
              ariaLabel={`${t(language, 'currency')}: ${getCurrencyLabel(language, selectedCurrency)}`}
              onPress={(event) => toggleMenu('currency', event)}
              active={activeMenu === 'currency'}
              dropdown
              compact
            />
          </div>
        </div>
      </div>
        </>
      ) : null}

      {mode !== 'ribbon' ? (
        <>
      <div className={styles.formulaWrap}>
        <div className={styles.formulaBar}>
          <div className={styles.cellRefBox}>{selectedCellRef}</div>
          <div className={styles.fxBadge}>fx</div>
          <button type="button" className={styles.functionButton} onClick={handleOpenFunctions}>
            ƒ
          </button>
          <div className={styles.formulaField} ref={formulaFieldRef}>
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
              placeholder={t(language, 'typeValueOrSum')}
              spellCheck={false}
            />
            {formulaInput.length > 0 ? (
              <button type="button" className={styles.submitButton} onClick={onFormulaSubmit}>
                ✓
              </button>
            ) : null}
          </div>
        </div>

        <FunctionSuggestions
          anchorStyle={suggestionsAnchor?.style}
          language={language}
          suggestions={suggestions}
          onSelect={handleFunctionSelect}
          visible={suggestions.length > 0 || showAllFunctions}
        />
      </div>
        </>
      ) : null}

      {(mode === 'all' || mode === 'ribbon') && activeMenu === 'fill' && menuAnchor ? (
        <PickerCard
          title={t(language, 'fillColor')}
          doneLabel={t(language, 'done')}
          onClose={() => {
            setActiveMenu(null);
            setMenuAnchor(null);
          }}
          anchor={menuAnchor}
          compact
        >
          <div className={styles.colorGrid}>
            {fillOptions.map((option) => (
              <ColorOption
                key={option.value}
                label={option.label}
                color={option.value}
                selected={selectedFillColor === option.value}
                onPress={() => {
                  onColorPress(option.value);
                  setActiveMenu(null);
                  setMenuAnchor(null);
                }}
              />
            ))}
          </div>
        </PickerCard>
      ) : null}

      {(mode === 'all' || mode === 'ribbon') && activeMenu === 'text' && menuAnchor ? (
        <PickerCard
          title={t(language, 'textColor')}
          doneLabel={t(language, 'done')}
          onClose={() => {
            setActiveMenu(null);
            setMenuAnchor(null);
          }}
          anchor={menuAnchor}
          compact
        >
          <div className={styles.colorGrid}>
            {textColorOptions.map((option) => (
              <ColorOption
                key={option.value}
                label={option.label}
                color={option.value}
                selected={selectedTextColor === option.value}
                onPress={() => {
                  onTextColorPress(option.value);
                  setActiveMenu(null);
                  setMenuAnchor(null);
                }}
              />
            ))}
          </div>
        </PickerCard>
      ) : null}

      {(mode === 'all' || mode === 'ribbon') && activeMenu === 'currency' && menuAnchor ? (
        <PickerCard
          title={t(language, 'currencyFormat')}
          doneLabel={t(language, 'done')}
          onClose={() => {
            setActiveMenu(null);
            setMenuAnchor(null);
          }}
          anchor={menuAnchor}
          compact
        >
          <div className={styles.listOptions}>
            {[...CURRENCIES, { key: '', symbol: '123', label: t(language, 'plainNumber') }].map((currency) => (
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
                  setMenuAnchor(null);
                }}
              >
                <span className={styles.listIconWrap}>{currency.symbol}</span>
                <span className={styles.listTextWrap}>
                  <span className={styles.listLabel}>{getCurrencyLabel(language, currency.key as Currency)}</span>
                  <span className={styles.listHint}>
                    {getCurrencyHint(language, currency.key as Currency, currency.symbol)}
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
  ariaLabel,
  label,
  detail,
  title,
  onPress,
  disabled,
  active,
  dropdown,
  emphasis,
  swatchColor,
  iconColor,
  compact,
}: {
  icon?: string;
  ariaLabel: string;
  label?: string;
  detail?: string;
  title?: string;
  onPress: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  active?: boolean;
  dropdown?: boolean;
  emphasis?: 'bold' | 'italic';
  swatchColor?: string;
  iconColor?: string;
  compact?: boolean;
}) {
  const swatchClass = swatchColor
    ? getDynamicClassName('toolbar-swatch', { backgroundColor: swatchColor })
    : '';
  const iconClass = iconColor
    ? getDynamicClassName('toolbar-icon', { color: iconColor })
    : '';
  const hasText = Boolean(label || detail) && !compact;

  return (
    <button
      type="button"
      className={classNames(
        styles.actionChip,
        compact && styles.actionChipCompact,
        disabled && styles.actionChipDisabled,
        active && styles.actionChipActive,
      )}
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
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
        {hasText ? (
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
        ) : null}
      </span>
      {dropdown ? <span className={classNames(styles.actionChevron, active && styles.actionChevronActive)}>▾</span> : null}
    </button>
  );
}

function PickerCard({
  title,
  doneLabel,
  onClose,
  anchor,
  compact,
  children,
}: {
  title: string;
  doneLabel: string;
  onClose: () => void;
  anchor: MenuAnchor;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={classNames(
        styles.pickerCard,
        compact && styles.pickerCardCompact,
        anchor.placement === 'top' && styles.pickerCardTop,
      )}
      style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
    >
      <div className={styles.pickerHeader}>
        <span className={styles.pickerTitle}>{title}</span>
        <button type="button" className={styles.doneButton} onClick={onClose}>
          {doneLabel}
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
