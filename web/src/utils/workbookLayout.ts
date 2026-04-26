import type { Cell, Sheet, Workbook } from '../types';

export const DEFAULT_VISIBLE_ROW_COUNT = 50;
export const DEFAULT_VISIBLE_COLUMN_COUNT = 23;
export const COLUMN_INCREMENT_COUNT = DEFAULT_VISIBLE_COLUMN_COUNT;

function parseCellRow(address: string) {
  const match = address.match(/[A-Z]+(\d+)$/i);
  if (!match) return null;
  return Math.max(0, parseInt(match[1], 10) - 1);
}

function parseCellCol(address: string) {
  const match = address.match(/^([A-Z]+)/i);
  if (!match) return null;

  let result = 0;
  const letters = match[1].toUpperCase();
  for (let index = 0; index < letters.length; index += 1) {
    result = result * 26 + (letters.charCodeAt(index) - 64);
  }

  return Math.max(0, result - 1);
}

export function getHighestUsedRowIndex(cells: Record<string, Cell>) {
  let highestRow = -1;

  for (const [address, cell] of Object.entries(cells)) {
    if (!cell) continue;
    if (cell.value === null && !cell.formula) continue;
    const rowIndex = parseCellRow(address);
    if (rowIndex !== null) {
      highestRow = Math.max(highestRow, rowIndex);
    }
  }

  return highestRow;
}

export function getRequiredVisibleRowCount(cells: Record<string, Cell>) {
  return Math.max(DEFAULT_VISIBLE_ROW_COUNT, getHighestUsedRowIndex(cells) + 1);
}

export function getHighestUsedColumnIndex(cells: Record<string, Cell>) {
  let highestCol = -1;

  for (const [address, cell] of Object.entries(cells)) {
    if (!cell) continue;
    if (cell.value === null && !cell.formula) continue;
    const colIndex = parseCellCol(address);
    if (colIndex !== null) {
      highestCol = Math.max(highestCol, colIndex);
    }
  }

  return highestCol;
}

export function getRequiredVisibleColumnCount(cells: Record<string, Cell>) {
  return Math.max(DEFAULT_VISIBLE_COLUMN_COUNT, getHighestUsedColumnIndex(cells) + 1);
}

export function normalizeSheet(sheet: Sheet): Sheet {
  return {
    ...sheet,
    visibleRowCount: Math.max(
      typeof sheet.visibleRowCount === 'number' ? sheet.visibleRowCount : DEFAULT_VISIBLE_ROW_COUNT,
      getRequiredVisibleRowCount(sheet.cells),
    ),
    visibleColumnCount: Math.max(
      typeof sheet.visibleColumnCount === 'number' ? sheet.visibleColumnCount : DEFAULT_VISIBLE_COLUMN_COUNT,
      getRequiredVisibleColumnCount(sheet.cells),
    ),
  };
}

export function normalizeWorkbook(workbook: Workbook): Workbook {
  const sheets = workbook.sheets.map(normalizeSheet);
  const activeSheetExists = sheets.some((sheet) => sheet.id === workbook.activeSheetId);

  return {
    ...workbook,
    sheets,
    activeSheetId: activeSheetExists ? workbook.activeSheetId : (sheets[0]?.id ?? ''),
  };
}

export function ensureRowCountForIndex(visibleRowCount: number, rowIndex: number) {
  return Math.max(visibleRowCount, rowIndex + 1);
}

export function ensureColumnCountForIndex(visibleColumnCount: number, colIndex: number) {
  return Math.max(visibleColumnCount, colIndex + 1);
}
