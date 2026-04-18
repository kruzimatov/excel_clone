import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Currency, CURRENCIES, CELL_COLORS } from '../types';

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

  const { height: screenH, width: screenW } = Dimensions.get('window');
  const menuWidth = 260;
  const menuHeight = 480; // approximate height for positioning

  let top = position.y;
  let left = position.x;

  // Smart positioning: if menu would go off-screen, flip it
  if (left + menuWidth > screenW - 10) {
    left = Math.max(10, position.x - menuWidth + 40);
  }
  if (top + menuHeight > screenH - 80) {
    top = Math.max(80, position.y - menuHeight + 40);
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.menu, { top, left, width: menuWidth, maxHeight: screenH - 100 }]}
          onStartShouldSetResponder={() => true}
        >
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Copy / Cut / Paste */}
            <MenuItem icon="📋" label="Copy" onPress={() => { onCopy(); onClose(); }} />
            <MenuItem icon="✂️" label="Cut" onPress={() => { onCut(); onClose(); }} />
            {hasClipboard && (
              <>
                <MenuItem icon="📄" label="Paste" onPress={() => { onPaste('all'); onClose(); }} />
                <MenuItem icon="🔢" label="Paste value only" onPress={() => { onPaste('value'); onClose(); }} />
                <MenuItem icon="🎨" label="Paste style only" onPress={() => { onPaste('style'); onClose(); }} />
              </>
            )}

            <View style={styles.divider} />

            {/* Format painter */}
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

            <View style={styles.divider} />

            {/* Formulas — always visible */}
            <Text style={styles.sectionTitle}>Formulas</Text>
            {FORMULAS.map((f) => (
              <MenuItem
                key={f.key}
                icon={f.icon}
                label={f.label}
                onPress={() => { onFormula(f.key); onClose(); }}
              />
            ))}

            <View style={styles.divider} />

            {/* Fill Color */}
            <Text style={styles.sectionTitle}>Fill Color</Text>
            <View style={styles.colorRow}>
              {CELL_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorDot, { backgroundColor: color }]}
                  onPress={() => { onColor(color); onClose(); }}
                />
              ))}
            </View>

            <View style={styles.divider} />

            {/* Currency */}
            <Text style={styles.sectionTitle}>Currency</Text>
            <View style={styles.currencyRow}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={styles.currencyBtn}
                  onPress={() => { onCurrency(c.key); onClose(); }}
                >
                  <Text style={styles.currencyText}>{c.symbol}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Clear */}
            <MenuItem
              icon="🗑️"
              label="Clear cells"
              onPress={() => { onClear(); onClose(); }}
              destructive
            />

            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
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
    <TouchableOpacity
      style={[styles.menuItem, highlight && styles.menuItemHighlight]}
      onPress={onPress}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={styles.menuLabelWrap}>
        <Text
          style={[
            styles.menuLabel,
            destructive && { color: '#CC0000' },
            highlight && { color: '#1A73E8' },
          ]}
        >
          {label}
        </Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menu: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    letterSpacing: 0.6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 0,
  },
  menuItemHighlight: {
    backgroundColor: '#E8F0FE',
  },
  menuIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
    marginRight: 12,
    fontWeight: '600',
  },
  menuLabelWrap: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    color: '#202124',
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
    marginHorizontal: 0,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  currencyRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  currencyBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems: 'center',
  },
  currencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
});
