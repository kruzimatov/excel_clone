import type { Cell, CellValue, Currency } from '../types';

const columnLetterCache = new Map<number, string>();
const numberFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const currencyFormatters: Record<Exclude<Currency, ''>, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }),
  RUB: new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }),
  UZS: new Intl.NumberFormat('uz-UZ', {
    style: 'currency',
    currency: 'UZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }),
  EUR: new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }),
};

export function colToLetter(col: number): string {
  const cached = columnLetterCache.get(col);
  if (cached) {
    return cached;
  }

  let result = '';
  let current = col;
  while (current >= 0) {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  }
  columnLetterCache.set(col, result);
  return result;
}

export function letterToCol(letter: string): number {
  let result = 0;
  for (let index = 0; index < letter.length; index += 1) {
    result = result * 26 + (letter.charCodeAt(index) - 64);
  }
  return result - 1;
}

export function cellKey(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

export function parseRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: letterToCol(match[1]), row: parseInt(match[2], 10) - 1 };
}

export function formatCurrency(value: number, currency: Currency): string {
  if (!currency) return formatNumber(value);

  try {
    return currencyFormatters[currency].format(value);
  } catch {
    return formatNumber(value);
  }
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function getDisplayValue(cell: Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (cell.display) return cell.display;

  const { value } = cell;
  if (typeof value === 'number') {
    return cell.style.currency
      ? formatCurrency(value, cell.style.currency)
      : formatNumber(value);
  }

  return String(value);
}

export function emptyCell(): Cell {
  return { value: null, style: {} };
}

export function isCellValueNumeric(value: CellValue): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
