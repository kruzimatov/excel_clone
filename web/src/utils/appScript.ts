import type { Cell, Workbook } from '../types';
import { normalizeWorkbook } from './workbookLayout';

interface RemoteSheetShape {
  name?: string;
  title?: string;
  rows?: unknown[][];
  data?: unknown[][];
  values?: unknown[][];
  cells?: Record<string, Cell>;
  visibleRowCount?: number;
}

interface RemoteWorkbookShape {
  title?: string;
  name?: string;
  sheets?: RemoteSheetShape[];
  tabs?: RemoteSheetShape[];
  workbook?: RemoteWorkbookShape;
}

function toCellValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value);
}

function rowsToCells(rows: unknown[][]) {
  const cells: Record<string, Cell> = {};

  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const cellValue = toCellValue(value);
      if (cellValue === null) return;

      const colLetter = String.fromCharCode(65 + colIndex);
      const key = `${colLetter}${rowIndex + 1}`;
      cells[key] = {
        value: cellValue,
        style: {},
      };
    });
  });

  return cells;
}

function normalizeRemoteWorkbookShape(input: unknown): RemoteWorkbookShape {
  if (!input || typeof input !== 'object') {
    throw new Error('Apps Script response is empty or invalid.');
  }

  const maybeWorkbook = input as RemoteWorkbookShape;
  return maybeWorkbook.workbook ?? maybeWorkbook;
}

export async function loadWorkbookFromAppsScript(endpoint: string): Promise<{
  title: string;
  workbook: Workbook;
}> {
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Apps Script request failed (${response.status}).`);
  }

  const payload = normalizeRemoteWorkbookShape(await response.json());
  const remoteSheets = payload.sheets ?? payload.tabs;

  if (!remoteSheets || remoteSheets.length === 0) {
    throw new Error('Apps Script returned no sheets.');
  }

  const sheets = remoteSheets.map((sheet, index) => {
    const rows = sheet.rows ?? sheet.data ?? sheet.values ?? [];
    const cells = sheet.cells ?? rowsToCells(rows);

    return {
      id: `appscript-${index}-${Date.now()}`,
      name: sheet.name ?? sheet.title ?? `Sheet ${index + 1}`,
      cells,
      colWidths: {},
      rowHeights: {},
      visibleRowCount: sheet.visibleRowCount ?? 50,
    };
  });

  return {
    title: payload.title ?? payload.name ?? 'Apps Script workbook',
    workbook: normalizeWorkbook({
      sheets,
      activeSheetId: sheets[0].id,
    }),
  };
}
