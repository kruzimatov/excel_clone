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
  formula?: string;
  display?: string;
  style: CellStyle;
}

export interface Sheet {
  id: string;
  name: string;
  cells: Record<string, Cell>;
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
  '#FFFFFF',
  '#C6EFCE',
  '#B7E1CD',
  '#A8D8EA',
  '#FFC7CE',
  '#FFEB9C',
  '#D9E1F2',
  '#E2EFDA',
  '#FCE4D6',
  '#D6DCE4',
];
