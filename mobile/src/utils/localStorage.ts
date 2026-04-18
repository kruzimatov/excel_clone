import { Directory, File, Paths } from 'expo-file-system/next';
import { Platform } from 'react-native';
import { Workbook } from '../types';

const IS_WEB = Platform.OS === 'web';

export interface StoredWorkbookDraft {
  version: 1;
  savedAt: string;
  title: string;
  currentFileName: string | null;
  workbook: Workbook;
}

function ensureStorageDirectories() {
  if (IS_WEB) return;
  getStorageRootDir().create({ idempotent: true, intermediates: true });
  getExportsDir().create({ idempotent: true, intermediates: true });
  getDraftsDir().create({ idempotent: true, intermediates: true });
}

function getStorageRootDir() {
  return new Directory(Paths.document, 'ExcelClone');
}

function getExportsDir() {
  return new Directory(getStorageRootDir(), 'SavedWorkbooks');
}

function getDraftsDir() {
  return new Directory(getStorageRootDir(), 'Drafts');
}

function getCurrentDraftFile() {
  return new File(getDraftsDir(), 'current-workbook.json');
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
    value.version === 1 &&
    typeof value.savedAt === 'string' &&
    typeof value.title === 'string' &&
    (typeof value.currentFileName === 'string' || value.currentFileName === null) &&
    isWorkbook(value.workbook)
  );
}

export async function loadWorkbookDraft(): Promise<StoredWorkbookDraft | null> {
  if (IS_WEB) return null;
  ensureStorageDirectories();

  const draftFile = getCurrentDraftFile();
  if (!draftFile.exists) return null;

  try {
    const raw = await draftFile.text();
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
}): File {
  if (IS_WEB) {
    throw new Error('Local draft storage is not supported on web.');
  }
  ensureStorageDirectories();

  const draftFile = getCurrentDraftFile();
  draftFile.create({ intermediates: true, overwrite: true });
  draftFile.write(
    JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      title: input.title,
      currentFileName: input.currentFileName,
      workbook: input.workbook,
    } satisfies StoredWorkbookDraft),
    { encoding: 'utf8' }
  );

  return draftFile;
}

export function saveWorkbookExport(fileName: string, base64: string): File {
  if (IS_WEB) {
    throw new Error('Local file export is not supported on web.');
  }
  ensureStorageDirectories();

  const exportFile = new File(getExportsDir(), fileName);
  exportFile.create({ intermediates: true, overwrite: true });
  exportFile.write(base64, { encoding: 'base64' });

  return exportFile;
}
