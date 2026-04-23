import type { FileDescriptor, RecentFileEntry, Workbook } from '../types';
import { normalizeWorkbook } from './workbookLayout';

const DRAFT_STORAGE_KEY = 'excel-clone-web:current-workbook';
const RECENTS_STORAGE_KEY = 'excel-clone-web:recent-files';
const DRIVE_FOLDER_KEY = 'excel-clone-web:drive-folder-id';

export interface StoredWorkbookDraft {
  version: 2;
  savedAt: string;
  title: string;
  currentFileName: string | null;
  activeFile: FileDescriptor | null;
  workbook: Workbook;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorkbook(value: unknown): value is Workbook {
  if (!isRecord(value)) return false;
  return Array.isArray(value.sheets) && typeof value.activeSheetId === 'string';
}

function normalizeDraft(value: unknown): StoredWorkbookDraft | null {
  if (!isRecord(value)) return null;

  if (
    value.version === 2
    && typeof value.savedAt === 'string'
    && typeof value.title === 'string'
    && (typeof value.currentFileName === 'string' || value.currentFileName === null)
    && (value.activeFile === null || isRecord(value.activeFile))
    && isWorkbook(value.workbook)
  ) {
    return {
      version: 2,
      savedAt: value.savedAt,
      title: value.title,
      currentFileName: value.currentFileName,
      activeFile: value.activeFile as FileDescriptor | null,
      workbook: normalizeWorkbook(value.workbook),
    };
  }

  if (
    value.version === 1
    && typeof value.savedAt === 'string'
    && typeof value.title === 'string'
    && (typeof value.currentFileName === 'string' || value.currentFileName === null)
    && isWorkbook(value.workbook)
  ) {
    return {
      version: 2,
      savedAt: value.savedAt,
      title: value.title,
      currentFileName: value.currentFileName,
      activeFile: null,
      workbook: normalizeWorkbook(value.workbook),
    };
  }

  return null;
}

function normalizeRecentFile(value: unknown): RecentFileEntry | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || (typeof value.currentFileName !== 'string' && value.currentFileName !== null)
    || typeof value.name !== 'string'
    || (value.source !== 'device' && value.source !== 'google-drive' && value.source !== 'appscript')
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    currentFileName: value.currentFileName,
    source: value.source,
    name: value.name,
    fileId: typeof value.fileId === 'string' ? value.fileId : undefined,
    fileHandleId: typeof value.fileHandleId === 'string' ? value.fileHandleId : undefined,
    driveFolderId: typeof value.driveFolderId === 'string' ? value.driveFolderId : undefined,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : undefined,
    modifiedAt: typeof value.modifiedAt === 'string' ? value.modifiedAt : undefined,
    lastOpenedAt: typeof value.lastOpenedAt === 'string' ? value.lastOpenedAt : undefined,
  };
}

export async function loadWorkbookDraft(): Promise<StoredWorkbookDraft | null> {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveWorkbookDraft(input: {
  workbook: Workbook;
  title: string;
  currentFileName: string | null;
  activeFile: FileDescriptor | null;
}) {
  const draft = {
    version: 2,
    savedAt: new Date().toISOString(),
    title: input.title,
    currentFileName: input.currentFileName,
    activeFile: input.activeFile,
    workbook: normalizeWorkbook(input.workbook),
  } satisfies StoredWorkbookDraft;

  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  return draft;
}

export function loadRecentFiles(): RecentFileEntry[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeRecentFile)
      .filter((entry): entry is RecentFileEntry => entry !== null)
      .sort((left, right) => (
        new Date(right.lastOpenedAt ?? 0).getTime() - new Date(left.lastOpenedAt ?? 0).getTime()
      ));
  } catch {
    return [];
  }
}

export function saveRecentFile(entry: Omit<RecentFileEntry, 'id' | 'lastOpenedAt'> & { id?: string }) {
  const nextEntry: RecentFileEntry = {
    ...entry,
    id: entry.id ?? `${entry.source}:${entry.fileId ?? entry.currentFileName ?? entry.name}`,
    lastOpenedAt: new Date().toISOString(),
  };

  const current = loadRecentFiles().filter((item) => item.id !== nextEntry.id);
  const updated = [nextEntry, ...current].slice(0, 20);
  window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function loadDriveFolderId() {
  return window.localStorage.getItem(DRIVE_FOLDER_KEY);
}

export function saveDriveFolderId(folderId: string | null) {
  if (folderId) {
    window.localStorage.setItem(DRIVE_FOLDER_KEY, folderId);
  } else {
    window.localStorage.removeItem(DRIVE_FOLDER_KEY);
  }
}
