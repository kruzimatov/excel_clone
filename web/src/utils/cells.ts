import type { Cell, CellValue, Currency } from '../types';

export function colToLetter(col: number): string {
  let result = '';
  let current = col;
  while (current >= 0) {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  }
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

  const options: Record<Currency, { locale: string; currency: string } | null> = {
    USD: { locale: 'en-US', currency: 'USD' },
    RUB: { locale: 'ru-RU', currency: 'RUB' },
    UZS: { locale: 'uz-UZ', currency: 'UZS' },
    EUR: { locale: 'de-DE', currency: 'EUR' },
    '': null,
  };

  const option = options[currency];
  if (!option) return formatNumber(value);

  try {
    return new Intl.NumberFormat(option.locale, {
      style: 'currency',
      currency: option.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return formatNumber(value);
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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
