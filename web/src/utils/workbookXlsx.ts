import * as XLSX from 'xlsx';

import type { Cell, Currency, Workbook } from '../types';
import { DEFAULT_VISIBLE_COLUMN_COUNT, normalizeWorkbook } from './workbookLayout';

interface XlsxCellStyle {
  font?: {
    bold?: boolean;
    italic?: boolean;
    color?: { rgb?: string };
  };
  fill?: {
    fgColor?: { rgb?: string };
  };
  numFmt?: string;
}

export function sanitizeFileName(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

export function baseNameNoExt(name: string) {
  return name.replace(/\.xlsx$/i, '');
}

function normalizeColor(value?: string) {
  if (!value) return undefined;
  const clean = value.replace('#', '');
  if (clean.length === 8) return `#${clean.slice(2).toUpperCase()}`;
  if (clean.length === 6) return `#${clean.toUpperCase()}`;
  return undefined;
}

function stripHash(value?: string) {
  return value?.replace('#', '').toUpperCase();
}

function detectCurrency(format?: string): Currency {
  if (!format) return '';
  const upper = format.toUpperCase();
  if (upper.includes('$')) return 'USD';
  if (upper.includes('₽') || upper.includes('RUB')) return 'RUB';
  if (upper.includes('UZS') || upper.includes("SO'M") || upper.includes('СУМ')) return 'UZS';
  if (upper.includes('€') || upper.includes('EUR')) return 'EUR';
  return '';
}

function getCurrencyFormat(currency: Currency) {
  switch (currency) {
    case 'USD':
      return '$#,##0.00';
    case 'RUB':
      return '#,##0.00 ₽';
    case 'UZS':
      return '#,##0.00 "UZS"';
    case 'EUR':
      return '€#,##0.00';
    default:
      return undefined;
  }
}

function sheetjsToCells(worksheet: XLSX.WorkSheet): Record<string, Cell> {
  const cells: Record<string, Cell> = {};
  if (!worksheet) return cells;

  for (const [address, rawCell] of Object.entries(worksheet)) {
    if (address.startsWith('!')) continue;
    if (!/^[A-Z]+\d+$/i.test(address)) continue;

    const workbookCell = rawCell as (XLSX.CellObject & { s?: XlsxCellStyle }) | undefined;
    if (!workbookCell) continue;

    const cell: Cell = {
      value: null,
      display: typeof workbookCell.w === 'string' ? workbookCell.w : undefined,
      style: {},
    };

    if (workbookCell.f) {
      cell.formula = `=${workbookCell.f}`;
    }

    if (workbookCell.v !== undefined && workbookCell.v !== null) {
      cell.value = typeof workbookCell.v === 'boolean'
        ? (workbookCell.v ? 1 : 0)
        : workbookCell.v as string | number;
    }

    const workbookStyle = workbookCell.s;
    if (workbookStyle?.font?.bold) cell.style.bold = true;
    if (workbookStyle?.font?.italic) cell.style.italic = true;

    const textColor = normalizeColor(workbookStyle?.font?.color?.rgb);
    const bgColor = normalizeColor(workbookStyle?.fill?.fgColor?.rgb);
    if (textColor) cell.style.textColor = textColor;
    if (bgColor) cell.style.bgColor = bgColor;

    const currency = detectCurrency(String(workbookCell.z ?? workbookStyle?.numFmt ?? ''));
    if (currency) cell.style.currency = currency;

    if (cell.value !== null || cell.formula) {
      cells[address] = cell;
    }
  }

  return cells;
}

function cellsToSheetjs(cells: Record<string, Cell>): XLSX.WorkSheet {
  const worksheet: XLSX.WorkSheet = {};
  let maxRow = -1;
  let maxCol = -1;

  for (const [address, cell] of Object.entries(cells)) {
    if (cell.value === null && !cell.formula) continue;

    const decoded = XLSX.utils.decode_cell(address);
    maxRow = Math.max(maxRow, decoded.r);
    maxCol = Math.max(maxCol, decoded.c);

    const outputCell = {} as XLSX.CellObject & { s?: Record<string, unknown> };
    if (cell.formula) {
      outputCell.f = cell.formula.startsWith('=') ? cell.formula.slice(1) : cell.formula;
    }
    if (cell.value !== undefined && cell.value !== null) {
      outputCell.v = cell.value;
      outputCell.t = typeof cell.value === 'number' ? 'n' : 's';
    }

    const style: Record<string, unknown> = {};
    const font: Record<string, unknown> = {};
    if (cell.style.bold) font.bold = true;
    if (cell.style.italic) font.italic = true;
    if (cell.style.textColor) font.color = { rgb: stripHash(cell.style.textColor) };
    if (Object.keys(font).length > 0) style.font = font;

    if (cell.style.bgColor) {
      style.fill = {
        patternType: 'solid',
        fgColor: { rgb: stripHash(cell.style.bgColor) },
      };
    }

    style.alignment = {
      horizontal: typeof cell.value === 'number' ? 'right' : 'left',
      vertical: 'center',
    };

    if (Object.keys(style).length > 0) {
      outputCell.s = style;
    }

    const currencyFormat = getCurrencyFormat(cell.style.currency ?? '');
    if (currencyFormat) {
      outputCell.z = currencyFormat;
    }

    worksheet[address] = outputCell;
  }

  worksheet['!ref'] = maxRow >= 0 && maxCol >= 0
    ? XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
    : 'A1';

  return worksheet;
}

export async function importWorkbookFromFile(file: File): Promise<Workbook> {
  const arrayBuffer = await file.arrayBuffer();
  return importWorkbookFromArrayBuffer(arrayBuffer);
}

export function importWorkbookFromArrayBuffer(arrayBuffer: ArrayBuffer): Workbook {
  const importedWorkbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellStyles: true,
    cellNF: true,
    cellText: true,
  });

  const sheets = importedWorkbook.SheetNames.map((sheetName, index) => ({
    id: `imported-${index}-${Date.now()}`,
    name: sheetName,
    cells: sheetjsToCells(importedWorkbook.Sheets[sheetName]),
    colWidths: {},
    rowHeights: {},
    visibleRowCount: 50,
    visibleColumnCount: DEFAULT_VISIBLE_COLUMN_COUNT,
  }));

  if (sheets.length === 0) {
    throw new Error('No sheets found in this workbook.');
  }

  return normalizeWorkbook({
    sheets,
    activeSheetId: sheets[0].id,
  });
}

export function buildWorkbookBlob(workbook: Workbook) {
  const outputWorkbook = XLSX.utils.book_new();

  for (const sheet of workbook.sheets) {
    const worksheet = cellsToSheetjs(sheet.cells);
    const safeName = sheet.name.slice(0, 31).replace(/[/\\?*[\]]/g, '_') || 'Sheet';
    XLSX.utils.book_append_sheet(outputWorkbook, worksheet, safeName);
  }

  const data = XLSX.write(outputWorkbook, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true,
  });

  return new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadWorkbookFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
