import type { Workbook } from '../types';

const STORAGE_KEY = 'excel-clone-web:current-workbook';

export interface StoredWorkbookDraft {
  version: 1;
  savedAt: string;
  title: string;
  currentFileName: string | null;
  workbook: Workbook;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorkbook(value: unknown): value is Workbook {
  if (!isRecord(value)) return false;
  return Array.isArray(value.sheets) && typeof value.activeSheetId === 'string';
}

function isStoredWorkbookDraft(value: unknown): value is StoredWorkbookDraft {
  if (!isRecord(value)) return false;

  return (
    value.version === 1
    && typeof value.savedAt === 'string'
    && typeof value.title === 'string'
    && (typeof value.currentFileName === 'string' || value.currentFileName === null)
    && isWorkbook(value.workbook)
  );
}

export async function loadWorkbookDraft(): Promise<StoredWorkbookDraft | null> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredWorkbookDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWorkbookDraft(input: {
  workbook: Workbook;
  title: string;
  currentFileName: string | null;
}) {
  const draft = {
    version: 1,
    savedAt: new Date().toISOString(),
    title: input.title,
    currentFileName: input.currentFileName,
    workbook: input.workbook,
  } satisfies StoredWorkbookDraft;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  return draft;
}
