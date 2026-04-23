import { cellKey, formatNumber } from '../utils/cells';
import type { Cell, Selection } from '../types';
import { t, type AppLanguage } from '../utils/i18n';

import styles from './StatusBar.module.css';

interface StatusBarProps {
  language: AppLanguage;
  cells: Record<string, Cell>;
  selection: Selection;
}

export function StatusBar({ language, cells, selection }: StatusBarProps) {
  const { start, end } = selection;
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);

  if (minRow === maxRow && minCol === maxCol) {
    return null;
  }

  const numbers: number[] = [];
  let count = 0;

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const cell = cells[cellKey(row, col)];
      if (!cell || cell.value === null || cell.value === undefined) continue;
      count += 1;
      const parsed = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value));
      if (!Number.isNaN(parsed)) numbers.push(parsed);
    }
  }

  if (numbers.length === 0 && count === 0) {
    return null;
  }

  const sum = numbers.reduce((accumulator, value) => accumulator + value, 0);
  const avg = numbers.length ? sum / numbers.length : 0;

  return (
    <div className={styles.container}>
      <Stat label={t(language, 'statusSum')} value={formatNumber(sum)} />
      <Stat label={t(language, 'statusAverage')} value={formatNumber(avg)} />
      <Stat label={t(language, 'statusCount')} value={String(count)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
