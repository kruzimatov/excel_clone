import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { HomeScreen } from './components/HomeScreen';
import { SpreadsheetScreen } from './components/SpreadsheetScreen';
import { createDefaultWorkbook, useWorkbook } from './store/useWorkbook';
import type { FileDescriptor, RecentFileEntry } from './types';
import {
  createWorkbookRecord,
  getStorageHealth,
  getWorkbook,
  listWorkbooks,
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

type Screen = 'home' | 'editor';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

function buildSnapshot(payload: PersistWorkbookPayload) {
  return JSON.stringify(payload);
}

function toRecentFileEntry(record: Omit<BackendWorkbookRecord, 'workbook'>): RecentFileEntry {
  return {
    id: record.id,
    title: record.title,
    currentFileName: record.currentFileName,
    source: record.activeFile?.source ?? 'backend',
    name: record.activeFile?.name ?? record.title,
    fileHandleId: record.activeFile?.fileHandleId,
    mimeType: record.activeFile?.mimeType,
    modifiedAt: record.updatedAt,
    lastOpenedAt: record.lastOpenedAt,
  };
}

function App() {
  const workbookStore = useWorkbook();
  const loadWorkbook = workbookStore.loadWorkbook;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastPersistedSnapshotRef = useRef<string | null>(null);

  const [screen, setScreen] = useState<Screen>('home');
  const [title, setTitle] = useState('Hisobot');
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<FileDescriptor | null>({
    source: 'backend',
    name: 'Hisobot',
  });
  const [backendWorkbookId, setBackendWorkbookId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof buildDraftSummary>>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageHealthy, setStorageHealthy] = useState(false);
  const [storageMessage, setStorageMessage] = useState('Checking backend...');
  const [storageSaving, setStorageSaving] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);

  const persistPayload = useMemo<PersistWorkbookPayload>(() => ({
    title,
    currentFileName,
    activeFile,
    workbook: workbookStore.workbook,
  }), [activeFile, currentFileName, title, workbookStore.workbook]);
  const persistSnapshot = useMemo(() => buildSnapshot(persistPayload), [persistPayload]);

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
    setBackendWorkbookId(record.id);
    setTitle(record.title);
    setCurrentFileName(record.currentFileName);
    setActiveFile(record.activeFile);
    lastPersistedSnapshotRef.current = buildSnapshot({
      title: record.title,
      currentFileName: record.currentFileName,
      activeFile: record.activeFile,
      workbook: record.workbook,
    });
  }, []);

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

    workbookStore.loadWorkbook(importedWorkbook);
    applySession({
      nextTitle: baseNameNoExt(file.name) || 'Workbook',
      nextFileName: safeName,
      nextActiveFile: descriptor,
      navigateTo: 'editor',
    });
    lastPersistedSnapshotRef.current = null;
  }, [applySession, workbookStore]);

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

    if (mode === 'autosave' && persistSnapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    setStorageSaving(true);

    try {
      const savedRecord = backendWorkbookId
        ? await updateWorkbookRecord(backendWorkbookId, persistPayload)
        : await createWorkbookRecord(persistPayload);

      setStorageHealthy(true);
      setStorageMessage('Express API connected to PostgreSQL.');
      syncPersistedMetadata(savedRecord);
      await syncRecentFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backend save failed.';
      setStorageHealthy(false);
      setStorageMessage(message);
      if (mode === 'manual') {
        window.alert(`Save failed: ${message}`);
      }
    } finally {
      setStorageSaving(false);
    }
  }, [
    backendWorkbookId,
    persistPayload,
    persistSnapshot,
    storageHealthy,
    storageReady,
    syncPersistedMetadata,
    syncRecentFiles,
  ]);

  useEffect(() => {
    if (screen !== 'editor' || !storageReady || !storageHealthy) return undefined;
    if (persistSnapshot === lastPersistedSnapshotRef.current) return undefined;

    const timeoutId = window.setTimeout(() => {
      void persistWorkbook('autosave');
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [persistSnapshot, persistWorkbook, screen, storageHealthy, storageReady]);

  const handleCreateBlank = useCallback(() => {
    const nextWorkbook = createDefaultWorkbook();
    workbookStore.loadWorkbook(nextWorkbook);
    applySession({
      nextTitle: 'Untitled spreadsheet',
      nextFileName: 'Untitled spreadsheet.xlsx',
      nextActiveFile: {
        source: 'backend',
        name: 'Untitled spreadsheet',
      },
      navigateTo: 'editor',
    });
    lastPersistedSnapshotRef.current = null;
  }, [applySession, workbookStore]);

  const handleResumeDraft = useCallback(() => {
    const latest = recentFiles[0];
    if (!latest) return;
    void (async () => {
      setStorageLoading(true);
      try {
        const record = await getWorkbook(latest.id);
        loadWorkbook(record.workbook);
        syncPersistedMetadata(record);
        setScreen('editor');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load workbook.';
        setStorageHealthy(false);
        setStorageMessage(message);
        window.alert(`Open failed: ${message}`);
      } finally {
        setStorageLoading(false);
      }
    })();
  }, [loadWorkbook, recentFiles, syncPersistedMetadata]);

  const handleOpenFromDevice = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await openWorkbookFromDeviceFile(file);
    } catch (error) {
      window.alert(`Open failed: ${String(error)}`);
    } finally {
      event.target.value = '';
    }
  }, [openWorkbookFromDeviceFile]);

  const handleSave = useCallback(() => {
    void persistWorkbook('manual');
  }, [persistWorkbook]);

  const handleSaveAs = useCallback(() => {
    try {
      const fileName = buildWorkbookFileName(currentFileName, title);
      const blob = buildWorkbookBlob(workbookStore.workbook);
      downloadWorkbookFile(blob, fileName);

      const descriptor: FileDescriptor = {
        source: 'device',
        name: fileName,
        mimeType: XLSX_MIME_TYPE,
        modifiedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      };

      applySession({
        nextTitle: baseNameNoExt(fileName) || title,
        nextFileName: fileName,
        nextActiveFile: descriptor,
        nextBackendWorkbookId: backendWorkbookId,
      });
    } catch (error) {
      window.alert(`Save As failed: ${String(error)}`);
    }
  }, [applySession, backendWorkbookId, currentFileName, title, workbookStore.workbook]);

  const handleOpenRecentFile = useCallback((entry: RecentFileEntry) => {
    void (async () => {
      setStorageLoading(true);
      try {
        const record = await getWorkbook(entry.id);
        loadWorkbook(record.workbook);
        syncPersistedMetadata(record);
        setScreen('editor');
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load workbook.';
        setStorageHealthy(false);
        setStorageMessage(message);
        window.alert(`Open failed: ${message}`);
      } finally {
        setStorageLoading(false);
      }
    })();
  }, [loadWorkbook, syncPersistedMetadata, syncRecentFiles]);

  const handleReloadFromBackend = useCallback(() => {
    if (!backendWorkbookId) return;
    void (async () => {
      setStorageLoading(true);
      try {
        const record = await getWorkbook(backendWorkbookId);
        loadWorkbook(record.workbook);
        syncPersistedMetadata(record);
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backend reload failed.';
        setStorageHealthy(false);
        setStorageMessage(message);
        window.alert(`Reload failed: ${message}`);
      } finally {
        setStorageLoading(false);
      }
    })();
  }, [backendWorkbookId, loadWorkbook, syncPersistedMetadata, syncRecentFiles]);

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
          draft={draft}
          recentFiles={recentFiles}
          storage={{
            ready: storageReady,
            healthy: storageHealthy,
            message: storageMessage,
          }}
          onResumeDraft={handleResumeDraft}
          onCreateBlank={handleCreateBlank}
          onOpenFromDevice={handleOpenFromDevice}
          onRefreshStorage={() => void syncRecentFiles()}
          onOpenRecentFile={handleOpenRecentFile}
        />
      ) : (
        <SpreadsheetScreen
          workbookStore={workbookStore}
          title={title}
          currentFileName={currentFileName}
          activeFile={activeFile}
          storageSaving={storageSaving}
          storageLoading={storageLoading}
          storageHealthy={storageHealthy}
          onGoHome={() => setScreen('home')}
          onOpenFromDevice={handleOpenFromDevice}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onReloadFromBackend={handleReloadFromBackend}
          onRenameTitle={setTitle}
        />
      )}
    </>
  );
}

export default App;
