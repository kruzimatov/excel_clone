export type CellValue = string | number | null;

export type Currency = 'USD' | 'RUB' | 'UZS' | 'EUR' | '';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  currency?: Currency;
}

export interface Cell {
  value: CellValue;
  formula?: string; // raw formula string like "=SUM(A1:A5)"
  display?: string; // formatted display value
  style: CellStyle;
}

export interface Sheet {
  id: string;
  name: string; // person name like "ФУАД АКА"
  cells: Record<string, Cell>; // key = "A1", "B2", etc.
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
}

export interface Workbook {
  sheets: Sheet[];
  activeSheetId: string;
}

export interface Selection {
  start: { row: number; col: number };
  end: { row: number; col: number };
}

export const CURRENCIES: { key: Currency; symbol: string; label: string }[] = [
  { key: 'USD', symbol: '$', label: 'US Dollar' },
  { key: 'RUB', symbol: '₽', label: 'Рубль' },
  { key: 'UZS', symbol: "so'm", label: "So'm" },
  { key: 'EUR', symbol: '€', label: 'Euro' },
];

export const CELL_COLORS = [
  '#FFFFFF', // white
  '#C6EFCE', // light green (income)
  '#B7E1CD', // green
  '#A8D8EA', // light blue/cyan
  '#FFC7CE', // light red (expense)
  '#FFEB9C', // light yellow
  '#D9E1F2', // light blue
  '#E2EFDA', // pale green
  '#FCE4D6', // light orange
  '#D6DCE4', // light gray
];
