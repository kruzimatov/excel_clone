import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Cell, Selection } from '../types';
import { cellKey, formatNumber } from '../utils/cells';

interface StatusBarProps {
  cells: Record<string, Cell>;
  selection: Selection;
}

export function StatusBar({ cells, selection }: StatusBarProps) {
  const stats = useMemo(() => {
    const { start, end } = selection;
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);

    if (minR === maxR && minC === maxC) return null;

    const numbers: number[] = [];
    let count = 0;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = cells[cellKey(r, c)];
        if (!cell || cell.value === null || cell.value === undefined) continue;
        count++;
        const num = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value));
        if (!isNaN(num)) numbers.push(num);
      }
    }

    if (numbers.length === 0 && count === 0) return null;

    const sum = numbers.reduce((a, b) => a + b, 0);
    const avg = numbers.length ? sum / numbers.length : 0;

    return { sum, avg, count, numCount: numbers.length };
  }, [cells, selection]);

  if (!stats) return null;

  return (
    <View style={styles.container}>
      <Stat label="SUM" value={formatNumber(stats.sum)} />
      <Stat label="AVG" value={formatNumber(stats.avg)} />
      <Stat label="COUNT" value={String(stats.count)} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#DADCE0',
    gap: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5F6368',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A73E8',
  },
});
