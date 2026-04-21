import { Cell, CellValue, Currency } from '../types';

// Convert column index (0-based) to letter: 0=A, 1=B, ..., 25=Z, 26=AA
export function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

// Convert letter to column index: A=0, B=1, ..., Z=25, AA=26
export function letterToCol(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

// Cell key from row/col: (0,0) => "A1"
export function cellKey(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

// Parse cell reference: "A1" => { row: 0, col: 0 }
export function parseRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: letterToCol(match[1]), row: parseInt(match[2]) - 1 };
}

// Format number with currency
export function formatCurrency(value: number, currency: Currency): string {
  if (!currency) return formatNumber(value);

  const opts: Record<Currency, { locale: string; currency: string } | null> = {
    USD: { locale: 'en-US', currency: 'USD' },
    RUB: { locale: 'ru-RU', currency: 'RUB' },
    UZS: { locale: 'uz-UZ', currency: 'UZS' },
    EUR: { locale: 'de-DE', currency: 'EUR' },
    '': null,
  };

  const opt = opts[currency];
  if (!opt) return formatNumber(value);

  try {
    return new Intl.NumberFormat(opt.locale, {
      style: 'currency',
      currency: opt.currency,
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

// Get display value for a cell
export function getDisplayValue(cell: Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (cell.display) return cell.display;

  const val = cell.value;
  if (typeof val === 'number') {
    return cell.style.currency
      ? formatCurrency(val, cell.style.currency)
      : formatNumber(val);
  }
  return String(val);
}

// Create empty cell
export function emptyCell(): Cell {
  return { value: null, style: {} };
}
