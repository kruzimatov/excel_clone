import { env } from '../config/env.js';
import type { CellRecord, WorkbookRecord } from '../types/workbook.js';

interface WorkbookSyncInput {
  id: string;
  title: string;
  currentFileName: string | null;
  workbook: WorkbookRecord;
  updatedAt?: string;
}

interface WorkbookCsvExport {
  fileName: string;
  csv: string;
  sheets: Array<{
    id: string;
    name: string;
    csv: string;
  }>;
}

type WorkbookSyncServiceResult =
  | { skipped: false; spreadsheetUrl?: string; spreadsheetId?: string }
  | { skipped: false; error: string }
  | { skipped: true; reason: string };

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function columnLabelToIndex(label: string) {
  let result = 0;
  for (const char of label.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return Math.max(0, result - 1);
}

function parseCellRef(cellRef: string) {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    col: columnLabelToIndex(match[1]),
    row: Math.max(0, parseInt(match[2], 10) - 1),
  };
}

function getCellCsvValue(cell: CellRecord | undefined) {
  if (!cell) {
    return '';
  }

  if (cell.formula) {
    return cell.display ?? cell.value ?? cell.formula;
  }

  return cell.display ?? cell.value ?? '';
}

function sheetToCsv(sheet: WorkbookRecord['sheets'][number]) {
  const rowMap = new Map<number, Map<number, CellRecord>>();
  let maxRow = -1;
  let maxCol = -1;

  for (const [cellRef, cell] of Object.entries(sheet.cells)) {
    const parsed = parseCellRef(cellRef);
    if (!parsed) continue;

    const row = rowMap.get(parsed.row) ?? new Map<number, CellRecord>();
    row.set(parsed.col, cell);
    rowMap.set(parsed.row, row);
    maxRow = Math.max(maxRow, parsed.row);
    maxCol = Math.max(maxCol, parsed.col);
  }

  if (maxRow < 0 || maxCol < 0) {
    return '';
  }

  const lines: string[] = [];
  for (let rowIndex = 0; rowIndex <= maxRow; rowIndex += 1) {
    const row = rowMap.get(rowIndex);
    const values: string[] = [];

    for (let colIndex = 0; colIndex <= maxCol; colIndex += 1) {
      values.push(escapeCsvValue(getCellCsvValue(row?.get(colIndex))));
    }

    lines.push(values.join(','));
  }

  return lines.join('\n');
}

function sanitizeFileNamePart(value: string) {
  return value.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'workbook';
}

export function buildWorkbookCsvExport(input: WorkbookSyncInput): WorkbookCsvExport {
  const sheets = input.workbook.sheets.map((sheet) => ({
    id: sheet.id,
    name: sheet.name,
    csv: sheetToCsv(sheet),
  }));

  const multiSheetCsv = sheets
    .flatMap((sheet) => [
      `Sheet,${escapeCsvValue(sheet.name)}`,
      sheet.csv,
    ])
    .join('\n\n');

  return {
    fileName: `${sanitizeFileNamePart(input.currentFileName ?? input.title)}.csv`.replace(/\.xlsx\.csv$/i, '.csv'),
    csv: multiSheetCsv,
    sheets,
  };
}

async function syncToAppsScript(input: WorkbookSyncInput, csvExport: WorkbookCsvExport) {
  if (!env.APPS_SCRIPT_WEBHOOK_URL) {
    return { skipped: true as const, reason: 'APPS_SCRIPT_WEBHOOK_URL is not configured.' };
  }

  const response = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.APPS_SCRIPT_SECRET ? { 'X-Workbook-Sync-Secret': env.APPS_SCRIPT_SECRET } : {}),
    },
    body: JSON.stringify({
      secret: env.APPS_SCRIPT_SECRET ?? null,
      id: input.id,
      title: input.title,
      currentFileName: input.currentFileName,
      updatedAt: input.updatedAt,
      activeSheetId: input.workbook.activeSheetId,
      sheets: input.workbook.sheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        csv: csvExport.sheets.find((item) => item.id === sheet.id)?.csv ?? '',
      })),
    }),
  });

  const rawBody = await response.text();
  let body: any = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail = body?.error && typeof body.error === 'string' ? `: ${body.error}` : '';
    throw new Error(`Apps Script sync failed (${response.status})${detail}.`);
  }

  if (body && body.ok === false) {
    const message = body.error && typeof body.error === 'string' ? body.error : 'Apps Script returned ok=false.';
    throw new Error(`Apps Script sync rejected: ${message}`);
  }

  return {
    skipped: false as const,
    spreadsheetId: typeof body?.spreadsheetId === 'string' ? body.spreadsheetId : undefined,
    spreadsheetUrl: typeof body?.spreadsheetUrl === 'string' ? body.spreadsheetUrl : undefined,
  };
}

async function syncToTelegram(input: WorkbookSyncInput, csvExport: WorkbookCsvExport) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { skipped: true as const, reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.' };
  }

  const formData = new FormData();
  formData.set('chat_id', env.TELEGRAM_CHAT_ID);
  formData.set('caption', `CSV export: ${input.title}`);
  formData.set('document', new Blob([csvExport.csv], { type: 'text/csv;charset=utf-8' }), csvExport.fileName);

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Telegram CSV upload failed (${response.status}).`);
  }

  return { skipped: false as const };
}

export async function syncWorkbookToAppsScript(input: WorkbookSyncInput) {
  const csvExport = buildWorkbookCsvExport(input);
  try {
    return await syncToAppsScript(input, csvExport);
  } catch (error) {
    return {
      skipped: false as const,
      error: error instanceof Error ? error.message : 'Apps Script sync failed.',
    };
  }
}

export async function syncWorkbookExternally(input: WorkbookSyncInput) {
  const csvExport = buildWorkbookCsvExport(input);
  const [appsScript, telegram] = await Promise.allSettled([
    syncToAppsScript(input, csvExport),
    syncToTelegram(input, csvExport),
  ]);

  return {
    appsScript: normalizeSyncResult(appsScript),
    telegram: normalizeSyncResult(telegram),
  };
}

function normalizeSyncResult(result: PromiseSettledResult<WorkbookSyncServiceResult>): WorkbookSyncServiceResult {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  return {
    skipped: false,
    error: result.reason instanceof Error ? result.reason.message : 'External sync failed.',
  };
}
