import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { HomeScreen } from './components/HomeScreen';
import { SpreadsheetScreen } from './components/SpreadsheetScreen';
import { createDefaultWorkbook, useWorkbook } from './store/useWorkbook';
import type { FileDescriptor, RecentFileEntry, SheetRowChunk } from './types';
import {
  beginChunkedWorkbookRecordSave,
  createWorkbookRecord,
  deleteWorkbookRecord,
  getStorageHealth,
  getWorkbook,
  getWorkbookMetadata,
  getWorkbookSheetRowsChunk,
  listWorkbooks,
  renameWorkbookRecord,
  uploadChunkedWorkbookSheet,
  updateWorkbookRecord,
  type BackendWorkbookRecord,
  type PersistWorkbookPayload,
} from './utils/backend';
import {
  baseNameNoExt,
  buildWorkbookBlob,
  downloadWorkbookFile,
  importWorkbookFromFile,
  sanitizeFileName,
} from './utils/workbookXlsx';
import {
  buildDefaultWorkbookTitle,
  buildUntitledWorkbookTitle,
  t,
  type AppLanguage,
} from './utils/i18n';

type Screen = 'home' | 'editor';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const LARGE_WORKBOOK_SAVE_CELL_THRESHOLD = 100_000;
const WORKBOOK_SAVE_CHUNK_BYTES = 2 * 1024 * 1024;
const WORKBOOK_LOAD_CHUNK_ROWS = 5000;
const WORKBOOK_MERGE_BATCH_ROWS = 25_000;

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function resolveWorkbookTitle(rawTitle: string | null | undefined, currentFileName: string | null) {
  const fileTitle = baseNameNoExt(currentFileName ?? '')?.trim();
  const title = rawTitle?.trim() ?? '';
  const genericTitles = new Set([
    '',
    'Untitled spreadsheet',
    'Nomsiz jadval',
    'Новая таблица',
    'Workbook',
  ]);

  if (fileTitle && genericTitles.has(title)) {
    return fileTitle;
  }

  return title || fileTitle || 'Workbook';
}

function buildDraftSummary(draft: RecentFileEntry | null) {
  if (!draft) return null;
  return {
    title: draft.title,
    savedAt: draft.lastOpenedAt ?? draft.modifiedAt ?? new Date().toISOString(),
    currentFileName: draft.currentFileName,
  };
}

function buildWorkbookFileName(currentFileName: string | null, title: string) {
  const suggested = currentFileName
    || sanitizeFileName(`${title || 'Workbook'}.xlsx`)
    || `Workbook-${Date.now()}.xlsx`;
  return suggested.endsWith('.xlsx') ? suggested : `${suggested}.xlsx`;
}

function buildPersistMarker(input: {
  title: string;
  currentFileName: string | null;
  activeFile: FileDescriptor | null;
  workbookVersion: number;
}) {
  return JSON.stringify(input);
}

function getWorkbookCellCount(workbook: PersistWorkbookPayload['workbook']) {
  return workbook.sheets.reduce((sum, sheet) => sum + Object.keys(sheet.cells).length, 0);
}

function groupSheetRowsForUpload(sheet: PersistWorkbookPayload['workbook']['sheets'][number]) {
  const rowsByIndex = new Map<number, Record<string, PersistWorkbookPayload['workbook']['sheets'][number]['cells'][string]>>();

  for (const [cellRef, cell] of Object.entries(sheet.cells)) {
    const match = cellRef.match(/^[A-Z]+(\d+)$/i);
    if (!match) continue;
    const rowIndex = Math.max(0, parseInt(match[1], 10) - 1);
    const rowCells = rowsByIndex.get(rowIndex) ?? {};
    rowCells[cellRef] = cell;
    rowsByIndex.set(rowIndex, rowCells);
  }

  return Array.from(rowsByIndex.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([rowIndex, cells]) => ({ rowIndex, cells }));
}

function chunkSheetRows(
  rows: Array<{ rowIndex: number; cells: Record<string, PersistWorkbookPayload['workbook']['sheets'][number]['cells'][string]> }>,
) {
  const chunks: typeof rows[] = [];
  let currentChunk: typeof rows = [];
  let currentBytes = 0;

  for (const row of rows) {
    const rowBytes = JSON.stringify(row).length;
    if (currentChunk.length > 0 && currentBytes + rowBytes > WORKBOOK_SAVE_CHUNK_BYTES) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentBytes = 0;
    }

    currentChunk.push(row);
    currentBytes += rowBytes;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function toRecentFileEntry(record: Omit<BackendWorkbookRecord, 'workbook'>): RecentFileEntry {
  const resolvedTitle = resolveWorkbookTitle(record.title, record.currentFileName);
  return {
    id: record.id,
    title: resolvedTitle,
    currentFileName: record.currentFileName,
    source: record.activeFile?.source ?? 'backend',
    name: record.activeFile?.name ?? resolvedTitle,
    fileHandleId: record.activeFile?.fileHandleId,
    mimeType: record.activeFile?.mimeType,
    modifiedAt: record.updatedAt,
    lastOpenedAt: record.lastOpenedAt,
  };
}

interface WorkbookLoadProgress {
  active: boolean;
  loadedRows: number;
  totalRows: number;
  currentSheetName: string;
}

interface BackendSheetStat {
  id: string;
  name: string;
  storedRowCount: number;
}

function App() {
  const workbookStore = useWorkbook();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastPersistedSnapshotRef = useRef<string | null>(null);
  const progressiveBackendWorkbookIdRef = useRef<string | null>(null);
  const backendSheetStatsRef = useRef<Map<string, BackendSheetStat>>(new Map());
  const loadedBackendSheetIdsRef = useRef<Set<string>>(new Set());
  const loadingBackendSheetIdsRef = useRef<Set<string>>(new Set());
  const language: AppLanguage = 'ru';
  const [screen, setScreen] = useState<Screen>('home');
  const [title, setTitle] = useState(() => buildDefaultWorkbookTitle(language));
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<FileDescriptor | null>({
    source: 'backend',
    name: buildDefaultWorkbookTitle(language),
  });
  const [backendWorkbookId, setBackendWorkbookId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof buildDraftSummary>>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageHealthy, setStorageHealthy] = useState(false);
  const [storageMessage, setStorageMessage] = useState('Checking backend...');
  const [storageSaving, setStorageSaving] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const [workbookLoadProgress, setWorkbookLoadProgress] = useState<WorkbookLoadProgress>({
    active: false,
    loadedRows: 0,
    totalRows: 0,
    currentSheetName: '',
  });

  const resolvedTitle = useMemo(
    () => resolveWorkbookTitle(title, currentFileName),
    [currentFileName, title],
  );
  const persistPayload = useMemo<PersistWorkbookPayload>(() => ({
    title: resolvedTitle,
    currentFileName,
    activeFile,
    workbook: workbookStore.workbook,
  }), [activeFile, currentFileName, resolvedTitle, workbookStore.workbook]);
  const persistMarker = useMemo(() => buildPersistMarker({
    title: resolvedTitle,
    currentFileName,
    activeFile,
    workbookVersion: workbookStore.changeVersion,
  }), [activeFile, currentFileName, resolvedTitle, workbookStore.changeVersion]);
  const workbookCellCount = useMemo(() => getWorkbookCellCount(workbookStore.workbook), [workbookStore.workbook]);

  const applySession = useCallback((input: {
    nextTitle: string;
    nextFileName: string | null;
    nextActiveFile: FileDescriptor | null;
    nextBackendWorkbookId?: string | null;
    navigateTo?: Screen;
  }) => {
    setTitle(input.nextTitle);
    setCurrentFileName(input.nextFileName);
    setActiveFile(input.nextActiveFile);
    setBackendWorkbookId(input.nextBackendWorkbookId ?? null);
    if (input.navigateTo) {
      setScreen(input.navigateTo);
    }
  }, []);

  const syncRecentFiles = useCallback(async () => {
    const [health, workbooks] = await Promise.all([
      getStorageHealth(),
      listWorkbooks(20),
    ]);

    setStorageHealthy(health.status === 'ok' && health.database === 'ok');
    setStorageMessage(health.message);

    const entries = workbooks.map((record) => toRecentFileEntry(record));
    setRecentFiles(entries);
    setDraft(buildDraftSummary(entries[0] ?? null));
    setStorageReady(true);
  }, []);

  const syncPersistedMetadata = useCallback((record: BackendWorkbookRecord) => {
    const nextTitle = resolveWorkbookTitle(record.title, record.currentFileName);
    setBackendWorkbookId(record.id);
    setTitle(nextTitle);
    setCurrentFileName(record.currentFileName);
    setActiveFile(record.activeFile);
  }, []);

  const syncPersistedSummary = useCallback((record: {
    id: string;
    title: string;
    currentFileName: string | null;
    activeFile: FileDescriptor | null;
  }) => {
    const nextTitle = resolveWorkbookTitle(record.title, record.currentFileName);
    setBackendWorkbookId(record.id);
    setTitle(nextTitle);
    setCurrentFileName(record.currentFileName);
    setActiveFile(record.activeFile);
  }, []);

  const resetProgressiveBackendLoadState = useCallback(() => {
    progressiveBackendWorkbookIdRef.current = null;
    backendSheetStatsRef.current = new Map();
    loadedBackendSheetIdsRef.current = new Set();
    loadingBackendSheetIdsRef.current = new Set();
    setWorkbookLoadProgress({
      active: false,
      loadedRows: 0,
      totalRows: 0,
      currentSheetName: '',
    });
  }, []);

  const loadBackendSheetProgressive = useCallback(async (
    workbookId: string,
    sheetId: string,
    visibleRowCountHint?: number,
  ) => {
    const sheetStat = backendSheetStatsRef.current.get(sheetId);
    if (!sheetStat) {
      return;
    }

    if (loadedBackendSheetIdsRef.current.has(sheetId) || loadingBackendSheetIdsRef.current.has(sheetId)) {
      return;
    }

    loadingBackendSheetIdsRef.current.add(sheetId);

    try {
      if (sheetStat.storedRowCount <= 0) {
        loadedBackendSheetIdsRef.current.add(sheetId);
        setWorkbookLoadProgress({
          active: false,
          loadedRows: 0,
          totalRows: 0,
          currentSheetName: '',
        });
        return;
      }

      setWorkbookLoadProgress({
        active: true,
        loadedRows: 0,
        totalRows: sheetStat.storedRowCount,
        currentSheetName: sheetStat.name,
      });

      let beforeRow = Math.max(0, visibleRowCountHint ?? sheetStat.storedRowCount);
      let done = false;
      let loadedRows = 0;
      let pendingRows: SheetRowChunk[] = [];
      let pendingRowCount = 0;

      const flushPendingRows = async () => {
        if (pendingRowCount === 0) {
          return;
        }

        workbookStore.mergeSheetRows(sheetId, pendingRows);
        loadedRows += pendingRowCount;
        pendingRows = [];
        pendingRowCount = 0;
        setWorkbookLoadProgress({
          active: true,
          loadedRows,
          totalRows: sheetStat.storedRowCount,
          currentSheetName: sheetStat.name,
        });
        await yieldToBrowser();
      };

      while (!done) {
        const chunk = await getWorkbookSheetRowsChunk(workbookId, sheetId, {
          direction: 'desc',
          beforeRow,
          limit: WORKBOOK_LOAD_CHUNK_ROWS,
        });

        if (chunk.rows.length > 0) {
          pendingRows = pendingRows.concat(chunk.rows);
          pendingRowCount += chunk.rows.length;
        }

        beforeRow = chunk.nextBeforeRow ?? beforeRow;
        done = chunk.done;

        if (pendingRowCount >= WORKBOOK_MERGE_BATCH_ROWS || done) {
          await flushPendingRows();
        }
      }

      loadedBackendSheetIdsRef.current.add(sheetId);
      setWorkbookLoadProgress((current) => (
        current.currentSheetName === sheetStat.name
          ? {
              active: false,
              loadedRows: sheetStat.storedRowCount,
              totalRows: sheetStat.storedRowCount,
              currentSheetName: sheetStat.name,
            }
          : current
      ));
    } finally {
      loadingBackendSheetIdsRef.current.delete(sheetId);
    }
  }, [workbookStore]);

  const openBackendWorkbookProgressive = useCallback(async (id: string) => {
    const metadata = await getWorkbookMetadata(id);
    const activeSheetId = metadata.workbook.activeSheetId;
    const activeSheet = metadata.workbook.sheets.find((sheet) => sheet.id === activeSheetId);

    progressiveBackendWorkbookIdRef.current = metadata.id;
    backendSheetStatsRef.current = new Map(metadata.sheetStats.map((sheet) => [sheet.id, sheet]));
    loadedBackendSheetIdsRef.current = new Set();
    loadingBackendSheetIdsRef.current = new Set();

    workbookStore.loadWorkbookShell(metadata.workbook);
    syncPersistedSummary(metadata);
    lastPersistedSnapshotRef.current = buildPersistMarker({
      title: resolveWorkbookTitle(metadata.title, metadata.currentFileName),
      currentFileName: metadata.currentFileName,
      activeFile: metadata.activeFile,
      workbookVersion: workbookStore.changeVersion + 1,
    });
    setScreen('editor');
    await loadBackendSheetProgressive(metadata.id, activeSheetId, activeSheet?.visibleRowCount);
    await syncRecentFiles();
  }, [loadBackendSheetProgressive, syncPersistedSummary, syncRecentFiles, workbookStore]);

  const openWorkbookFromDeviceFile = useCallback(async (file: File) => {
    const importedWorkbook = await importWorkbookFromFile(file);
    const safeName = sanitizeFileName(file.name);
    const descriptor: FileDescriptor = {
      source: 'device',
      name: safeName,
      mimeType: file.type || XLSX_MIME_TYPE,
      modifiedAt: new Date(file.lastModified || Date.now()).toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };

    resetProgressiveBackendLoadState();
    workbookStore.loadWorkbook(importedWorkbook);
    applySession({
      nextTitle: baseNameNoExt(file.name) || 'Workbook',
      nextFileName: safeName,
      nextActiveFile: descriptor,
      navigateTo: 'editor',
    });
    lastPersistedSnapshotRef.current = buildPersistMarker({
      title: baseNameNoExt(file.name) || 'Workbook',
      currentFileName: safeName,
      activeFile: descriptor,
      workbookVersion: workbookStore.changeVersion + 1,
    });
  }, [applySession, resetProgressiveBackendLoadState, workbookStore]);

  useEffect(() => {
    void (async () => {
      try {
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backend connection failed.';
        setStorageHealthy(false);
        setStorageMessage(message);
        setStorageReady(true);
      }
    })();
  }, [syncRecentFiles]);

  const persistWorkbook = useCallback(async (mode: 'manual' | 'autosave' = 'manual') => {
    if (mode === 'autosave' && (!storageReady || !storageHealthy)) {
      return;
    }

    if (mode === 'autosave' && workbookCellCount > LARGE_WORKBOOK_SAVE_CELL_THRESHOLD) {
      return;
    }

    if (mode === 'autosave' && activeFile?.source === 'device' && !backendWorkbookId) {
      return;
    }

    if (mode === 'autosave' && persistMarker === lastPersistedSnapshotRef.current) {
      return;
    }

    if (mode === 'manual') {
      setStorageSaving(true);
    }

    try {
      if (mode === 'manual' && workbookCellCount > LARGE_WORKBOOK_SAVE_CELL_THRESHOLD) {
        const savedSummary = await beginChunkedWorkbookRecordSave({
          id: backendWorkbookId,
          title: persistPayload.title,
          currentFileName: persistPayload.currentFileName,
          activeFile: persistPayload.activeFile,
          activeSheetId: persistPayload.workbook.activeSheetId,
        });

        for (const [position, sheet] of persistPayload.workbook.sheets.entries()) {
          const rowChunks = chunkSheetRows(groupSheetRowsForUpload(sheet));
          if (rowChunks.length === 0) {
            await uploadChunkedWorkbookSheet(savedSummary.id, {
              position,
              sheet: {
                id: sheet.id,
                name: sheet.name,
                colWidths: sheet.colWidths,
                rowHeights: sheet.rowHeights,
                visibleRowCount: sheet.visibleRowCount,
                visibleColumnCount: sheet.visibleColumnCount,
              },
              rows: [],
            });
            continue;
          }

          for (const rows of rowChunks) {
            await uploadChunkedWorkbookSheet(savedSummary.id, {
              position,
              sheet: {
                id: sheet.id,
                name: sheet.name,
                colWidths: sheet.colWidths,
                rowHeights: sheet.rowHeights,
                visibleRowCount: sheet.visibleRowCount,
                visibleColumnCount: sheet.visibleColumnCount,
              },
              rows,
            });
          }
        }

        setStorageHealthy(true);
        setStorageMessage('Express API connected to PostgreSQL.');
        syncPersistedSummary(savedSummary);
        lastPersistedSnapshotRef.current = persistMarker;
        await syncRecentFiles();
      } else {
        const savedRecord = backendWorkbookId
          ? await updateWorkbookRecord(backendWorkbookId, persistPayload)
          : await createWorkbookRecord(persistPayload);

        setStorageHealthy(true);
        setStorageMessage('Express API connected to PostgreSQL.');
        syncPersistedMetadata(savedRecord);
        lastPersistedSnapshotRef.current = persistMarker;
        await syncRecentFiles();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backend save failed.';
      setStorageHealthy(false);
      setStorageMessage(message);
      if (mode === 'manual') {
        window.alert(t(language, 'saveFailed', { message }));
      }
    } finally {
      if (mode === 'manual') {
        setStorageSaving(false);
      }
    }
  }, [
    backendWorkbookId,
    language,
    activeFile,
    persistPayload,
    persistMarker,
    storageHealthy,
    storageReady,
    syncPersistedSummary,
    syncPersistedMetadata,
    syncRecentFiles,
    workbookCellCount,
  ]);

  useEffect(() => {
    if (screen !== 'editor' || !storageReady || !storageHealthy) return undefined;
    if (persistMarker === lastPersistedSnapshotRef.current) return undefined;

    const timeoutId = window.setTimeout(() => {
      void persistWorkbook('autosave');
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [persistMarker, persistWorkbook, screen, storageHealthy, storageReady]);

  const handleCreateBlank = useCallback(() => {
    const nextWorkbook = createDefaultWorkbook();
    resetProgressiveBackendLoadState();
    workbookStore.loadWorkbook(nextWorkbook);
    const nextTitle = buildUntitledWorkbookTitle(language);
    applySession({
      nextTitle,
      nextFileName: `${nextTitle}.xlsx`,
      nextActiveFile: {
        source: 'backend',
        name: nextTitle,
      },
      navigateTo: 'editor',
    });
    lastPersistedSnapshotRef.current = buildPersistMarker({
      title: nextTitle,
      currentFileName: `${nextTitle}.xlsx`,
      activeFile: {
        source: 'backend',
        name: nextTitle,
      },
      workbookVersion: workbookStore.changeVersion + 1,
    });
  }, [applySession, language, resetProgressiveBackendLoadState, workbookStore.changeVersion, workbookStore.loadWorkbook]);

  const handleSwitchSheet = useCallback((sheetId: string) => {
    workbookStore.switchSheet(sheetId);

    const workbookId = progressiveBackendWorkbookIdRef.current;
    if (!workbookId) {
      return;
    }

    const sheet = workbookStore.workbook.sheets.find((item) => item.id === sheetId);
    void loadBackendSheetProgressive(workbookId, sheetId, sheet?.visibleRowCount);
  }, [loadBackendSheetProgressive, workbookStore]);

  const handleResumeDraft = useCallback(() => {
    const latest = recentFiles[0];
    if (!latest) return;
    void (async () => {
      try {
        setOpeningFile(true);
        await openBackendWorkbookProgressive(latest.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load workbook.';
        setStorageHealthy(false);
        setStorageMessage(message);
        window.alert(t(language, 'openFailed', { message }));
      } finally {
        setOpeningFile(false);
      }
    })();
  }, [language, openBackendWorkbookProgressive, recentFiles]);

  const handleOpenFromDevice = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setOpeningFile(true);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await openWorkbookFromDeviceFile(file);
    } catch (error) {
      window.alert(t(language, 'openFailed', { message: String(error) }));
    } finally {
      setOpeningFile(false);
      event.target.value = '';
    }
  }, [language, openWorkbookFromDeviceFile]);

  const handleSave = useCallback(() => {
    void persistWorkbook('manual');
  }, [persistWorkbook]);

  const handleDeleteCurrentWorkbook = useCallback(() => {
    if (!backendWorkbookId) {
      return;
    }

    if (!window.confirm(t(language, 'deleteWorkbookConfirm', { title: resolvedTitle }))) {
      return;
    }

    void (async () => {
      try {
        await deleteWorkbookRecord(backendWorkbookId);
        setBackendWorkbookId(null);
        resetProgressiveBackendLoadState();
        setScreen('home');
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Delete failed.';
        window.alert(t(language, 'deleteFailed', { message }));
      }
    })();
  }, [backendWorkbookId, language, resetProgressiveBackendLoadState, resolvedTitle, syncRecentFiles]);

  const handleDownloadWorkbook = useCallback((record: BackendWorkbookRecord) => {
    try {
      const fileName = buildWorkbookFileName(record.currentFileName, record.title);
      const blob = buildWorkbookBlob(record.workbook);
      downloadWorkbookFile(blob, fileName);
    } catch (error) {
      window.alert(t(language, 'downloadFailed', { message: String(error) }));
    }
  }, [language]);

  const handleOpenRecentFile = useCallback((entry: RecentFileEntry) => {
    void (async () => {
      try {
        setOpeningFile(true);
        await openBackendWorkbookProgressive(entry.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load workbook.';
        setStorageHealthy(false);
        setStorageMessage(message);
        window.alert(t(language, 'openFailed', { message }));
      } finally {
        setOpeningFile(false);
      }
    })();
  }, [language, openBackendWorkbookProgressive]);

  const handleRenameRecentFile = useCallback((entry: RecentFileEntry) => {
    const nextTitle = window.prompt(t(language, 'renameWorkbookPrompt'), entry.title)?.trim();
    if (!nextTitle || nextTitle === entry.title) return;

    void (async () => {
      try {
        const record = await renameWorkbookRecord(entry.id, nextTitle);
        if (backendWorkbookId === entry.id) {
          setTitle(resolveWorkbookTitle(record.title, record.currentFileName));
        }
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rename failed.';
        window.alert(t(language, 'renameFailed', { message }));
      }
    })();
  }, [backendWorkbookId, language, syncRecentFiles]);

  const handleDeleteRecentFile = useCallback((entry: RecentFileEntry) => {
    if (!window.confirm(t(language, 'deleteWorkbookConfirm', { title: entry.title }))) {
      return;
    }

    void (async () => {
      try {
        await deleteWorkbookRecord(entry.id);
        if (backendWorkbookId === entry.id) {
          setBackendWorkbookId(null);
          resetProgressiveBackendLoadState();
        }
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Delete failed.';
        window.alert(t(language, 'deleteFailed', { message }));
      }
    })();
  }, [backendWorkbookId, language, resetProgressiveBackendLoadState, syncRecentFiles]);

  const handleDownloadRecentFile = useCallback((entry: RecentFileEntry) => {
    void (async () => {
      try {
        const record = await getWorkbook(entry.id);
        handleDownloadWorkbook(record);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed.';
        window.alert(t(language, 'downloadFailed', { message }));
      }
    })();
  }, [handleDownloadWorkbook, language]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={handleFileChange}
      />

      {screen === 'home' ? (
        <HomeScreen
          language={language}
          draft={draft}
          recentFiles={recentFiles}
          loadingFile={openingFile}
          storage={{
            ready: storageReady,
            healthy: storageHealthy,
            message: storageMessage,
          }}
          onResumeDraft={handleResumeDraft}
          onCreateBlank={handleCreateBlank}
          onOpenFromDevice={handleOpenFromDevice}
          onOpenRecentFile={handleOpenRecentFile}
          onDownloadRecentFile={handleDownloadRecentFile}
          onRenameRecentFile={handleRenameRecentFile}
          onDeleteRecentFile={handleDeleteRecentFile}
        />
      ) : (
        <SpreadsheetScreen
          language={language}
          workbookStore={workbookStore}
          title={resolvedTitle}
          storageSaving={storageSaving}
          loadingProgress={workbookLoadProgress}
          canDeleteWorkbook={!!backendWorkbookId}
          onGoHome={() => setScreen('home')}
          onSave={handleSave}
          onSwitchSheet={handleSwitchSheet}
          onDeleteWorkbook={handleDeleteCurrentWorkbook}
          onRenameTitle={setTitle}
        />
      )}
    </>
  );
}

export default App;
