import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { CURRENCIES, CELL_COLORS, Currency } from '../types';
import { FunctionSuggestions } from './FunctionSuggestions';
import { filterFunctions, FunctionMeta } from '../utils/functionMetadata';

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

  const handleFormulaChange = (text: string) => {
    // Show suggestions if typing after =
    if (text.startsWith('=')) {
      const afterEquals = text.substring(1);
      // Show filtered or all functions
      const filtered = filterFunctions(afterEquals);
      setSuggestions(filtered);
      setShowAllFunctions(afterEquals.length === 0);
    } else {
      setSuggestions([]);
      setShowAllFunctions(false);
    }
    
    // Call parent handler
    onFormulaChange(text);
  };

  const handleFunctionSelect = (func: FunctionMeta) => {
    const newFormula = `=${func.russianName}()`;
    onFormulaChange(newFormula);
    setSuggestions([]);
    setShowAllFunctions(false);
  };

  const handleOpenFunctions = () => {
    // Show all functions when button is pressed
    setShowAllFunctions(true);
    setSuggestions(filterFunctions(''));
    // Force focus to formula input after showing functions
    setTimeout(() => {
      // Trigger onFormulaFocus if needed
      onFormulaFocus?.();
    }, 100);
  };

  const currentCurrency = useMemo(
    () => CURRENCIES.find((item) => item.key === selectedCurrency) ?? null,
    [selectedCurrency]
  );

  const fillLabel = useMemo(
    () =>
      FILL_OPTIONS.find((option) => option.value === selectedFillColor)?.label ?? 'Custom',
    [selectedFillColor]
  );

  const textLabel = useMemo(
    () =>
      TEXT_COLOR_OPTIONS.find((option) => option.value === selectedTextColor)?.label ?? 'Custom',
    [selectedTextColor]
  );

  const toggleMenu = (menu: Exclude<ActiveMenu, null>) => {
    setActiveMenu((current) => (current === menu ? null : menu));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.toolRow}
        contentContainerStyle={styles.toolRowContent}
      >
        <View style={styles.groupCard}>
          <ActionChip
            icon="[]"
            label={rangeSelectionLabel}
            detail={rangeSelectionDetail}
            onPress={onToggleRangeSelection}
            active={rangeSelectionActive}
          />
        </View>

        <View style={styles.groupCard}>
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
        </View>

        <View style={styles.groupCard}>
          <ActionChip
            icon="↶"
            label="Undo"
            onPress={onUndoPress}
            disabled={!canUndo}
          />
          <ActionChip
            icon="↷"
            label="Redo"
            onPress={onRedoPress}
            disabled={!canRedo}
          />
        </View>

        <View style={styles.groupCard}>
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
        </View>

        <View style={styles.groupCard}>
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
            icon={currentCurrency?.symbol ?? '$'}
            label="Currency"
            detail={currentCurrency?.label ?? 'Plain number'}
            onPress={() => toggleMenu('currency')}
            active={activeMenu === 'currency'}
            dropdown
          />
        </View>
      </ScrollView>

      <View style={styles.formulaBar}>
        <View style={styles.cellRefBox}>
          <Text style={styles.cellRefText}>{selectedCellRef}</Text>
        </View>
        <View style={styles.fxBadge}>
          <Text style={styles.fxLabel}>fx</Text>
        </View>
        <TouchableOpacity 
          style={styles.functionBtn}
          onPress={handleOpenFunctions}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.functionBtnText}>ƒ</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.formulaInput}
          value={formulaInput}
          onChangeText={handleFormulaChange}
          onFocus={onFormulaFocus}
          onSubmitEditing={onFormulaSubmit}
          placeholder="Type value or =СУММ"
          placeholderTextColor="#999"
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        {formulaInput.length > 0 && (
          <TouchableOpacity style={styles.submitBtn} onPress={onFormulaSubmit}>
            <Text style={styles.submitBtnText}>✓</Text>
          </TouchableOpacity>
        )}
      </View>

      <FunctionSuggestions
        suggestions={suggestions}
        onSelect={handleFunctionSelect}
        visible={suggestions.length > 0 || showAllFunctions}
      />

      {activeMenu === 'fill' && (
        <PickerCard title="Fill color" onClose={() => setActiveMenu(null)}>
          <View style={styles.colorGrid}>
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
          </View>
        </PickerCard>
      )}

      {activeMenu === 'text' && (
        <PickerCard title="Text color" onClose={() => setActiveMenu(null)}>
          <View style={styles.colorGrid}>
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
          </View>
        </PickerCard>
      )}

      {activeMenu === 'currency' && (
        <PickerCard title="Currency format" onClose={() => setActiveMenu(null)}>
          {[...CURRENCIES, { key: '', symbol: '123', label: 'Plain number' }].map((cur) => (
            <TouchableOpacity
              key={cur.key || 'plain'}
              style={[
                styles.listOption,
                selectedCurrency === cur.key && styles.listOptionActive,
              ]}
              onPress={() => {
                onCurrencyPress(cur.key as Currency);
                setActiveMenu(null);
              }}
            >
              <View style={styles.listIconWrap}>
                <Text style={styles.listIcon}>{cur.symbol}</Text>
              </View>
              <View style={styles.listTextWrap}>
                <Text style={styles.listLabel}>{cur.label}</Text>
                <Text style={styles.listHint}>
                  {cur.key ? `Format values as ${cur.symbol}` : 'Keep numbers without a currency sign'}
                </Text>
              </View>
              {selectedCurrency === cur.key && <Text style={styles.listCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </PickerCard>
      )}
    </View>
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
  return (
    <TouchableOpacity
      style={[
        styles.actionChip,
        disabled && styles.actionChipDisabled,
        active && styles.actionChipActive,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.actionMain}>
        {swatchColor ? (
          <View style={[styles.swatchPreview, { backgroundColor: swatchColor }]} />
        ) : (
          <Text
            style={[
              styles.actionIcon,
              emphasis === 'bold' && styles.actionIconBold,
              emphasis === 'italic' && styles.actionIconItalic,
              iconColor && { color: iconColor },
              active && styles.actionIconActive,
              disabled && styles.actionIconDisabled,
            ]}
          >
            {icon}
          </Text>
        )}
        <View style={styles.actionTextWrap}>
          <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>{label}</Text>
          {!!detail && (
            <Text style={[styles.actionDetail, active && styles.actionDetailActive]}>
              {detail}
            </Text>
          )}
        </View>
      </View>
      {dropdown && <Text style={[styles.actionChevron, active && styles.actionChevronActive]}>▾</Text>}
    </TouchableOpacity>
  );
}

function PickerCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.pickerCard}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.pickerClose}>Done</Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
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
  return (
    <TouchableOpacity
      style={[styles.colorOption, selected && styles.colorOptionActive]}
      onPress={onPress}
    >
      <View style={styles.colorTopRow}>
        <View style={[styles.colorSwatch, { backgroundColor: color }]} />
        {selected && <Text style={styles.colorCheck}>✓</Text>}
      </View>
      <Text style={[styles.colorLabel, selected && styles.colorLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F6F8FB',
    borderBottomWidth: 1,
    borderBottomColor: '#DCE3EC',
  },
  toolRow: {
    paddingTop: 10,
  },
  toolRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  groupCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8EF',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  actionChip: {
    minHeight: 54,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionChipDisabled: {
    opacity: 0.4,
  },
  actionChipActive: {
    backgroundColor: '#EEF4FF',
  },
  actionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 20,
    fontSize: 18,
    color: '#334155',
    textAlign: 'center',
  },
  actionIconBold: {
    fontWeight: '800',
  },
  actionIconItalic: {
    fontStyle: 'italic',
  },
  actionIconActive: {
    color: '#1D4ED8',
  },
  actionIconDisabled: {
    color: '#94A3B8',
  },
  swatchPreview: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  actionTextWrap: {
    gap: 2,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  actionLabelActive: {
    color: '#1D4ED8',
  },
  actionDetail: {
    fontSize: 11,
    color: '#64748B',
  },
  actionDetailActive: {
    color: '#1E40AF',
  },
  actionChevron: {
    fontSize: 12,
    color: '#94A3B8',
  },
  actionChevronActive: {
    color: '#1D4ED8',
  },
  formulaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 12,
    gap: 8,
  },
  cellRefBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6DEE8',
    minWidth: 64,
    alignItems: 'center',
  },
  cellRefText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  fxBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8EEF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fxLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#47637F',
    fontStyle: 'italic',
  },
  functionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  functionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#217346',
  },
  formulaInput: {
    flex: 1,
    minHeight: 42,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6DEE8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#202124',
  },
  submitBtn: {
    backgroundColor: '#1D4ED8',
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E8EF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  pickerClose: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 88,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  colorOptionActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  colorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  colorCheck: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  colorLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  colorLabelActive: {
    color: '#1E40AF',
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  listOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  listIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIcon: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
  },
  listTextWrap: {
    flex: 1,
    gap: 2,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  listHint: {
    fontSize: 12,
    color: '#64748B',
  },
  listCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});
