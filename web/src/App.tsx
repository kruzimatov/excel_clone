import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { HomeScreen } from './components/HomeScreen';
import { SpreadsheetScreen } from './components/SpreadsheetScreen';
import { createDefaultWorkbook, useWorkbook } from './store/useWorkbook';
import type { FileDescriptor, RecentFileEntry } from './types';
import {
  createWorkbookRecord,
  deleteWorkbookRecord,
  getStorageHealth,
  getWorkbook,
  listWorkbooks,
  renameWorkbookRecord,
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
  getStoredLanguage,
  persistLanguage,
  t,
  type AppLanguage,
} from './utils/i18n';

type Screen = 'home' | 'editor';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

function buildSnapshot(payload: PersistWorkbookPayload) {
  return JSON.stringify(payload);
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

function App() {
  const workbookStore = useWorkbook();
  const loadWorkbook = workbookStore.loadWorkbook;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastPersistedSnapshotRef = useRef<string | null>(null);

  const [language, setLanguage] = useState<AppLanguage>(() => getStoredLanguage());
  const [screen, setScreen] = useState<Screen>('home');
  const [title, setTitle] = useState(() => buildDefaultWorkbookTitle(getStoredLanguage()));
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<FileDescriptor | null>({
    source: 'backend',
    name: buildDefaultWorkbookTitle(getStoredLanguage()),
  });
  const [backendWorkbookId, setBackendWorkbookId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof buildDraftSummary>>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageHealthy, setStorageHealthy] = useState(false);
  const [storageMessage, setStorageMessage] = useState('Checking backend...');
  const [storageSaving, setStorageSaving] = useState(false);

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
    const nextTitle = resolveWorkbookTitle(record.title, record.currentFileName);
    setBackendWorkbookId(record.id);
    setTitle(nextTitle);
    setCurrentFileName(record.currentFileName);
    setActiveFile(record.activeFile);
    lastPersistedSnapshotRef.current = buildSnapshot({
      title: nextTitle,
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
    persistLanguage(language);
  }, [language]);

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

    if (mode === 'manual') {
      setStorageSaving(true);
    }

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
    lastPersistedSnapshotRef.current = null;
  }, [applySession, language, workbookStore]);

  const handleResumeDraft = useCallback(() => {
    const latest = recentFiles[0];
    if (!latest) return;
    void (async () => {
      try {
        const record = await getWorkbook(latest.id);
        loadWorkbook(record.workbook);
        syncPersistedMetadata(record);
        setScreen('editor');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load workbook.';
        setStorageHealthy(false);
        setStorageMessage(message);
        window.alert(t(language, 'openFailed', { message }));
      }
    })();
  }, [language, loadWorkbook, recentFiles, syncPersistedMetadata]);

  const handleOpenFromDevice = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await openWorkbookFromDeviceFile(file);
    } catch (error) {
      window.alert(t(language, 'openFailed', { message: String(error) }));
    } finally {
      event.target.value = '';
    }
  }, [language, openWorkbookFromDeviceFile]);

  const handleSave = useCallback(() => {
    void persistWorkbook('manual');
  }, [persistWorkbook]);

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
        const record = await getWorkbook(entry.id);
        loadWorkbook(record.workbook);
        syncPersistedMetadata(record);
        setScreen('editor');
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load workbook.';
        setStorageHealthy(false);
        setStorageMessage(message);
        window.alert(t(language, 'openFailed', { message }));
      }
    })();
  }, [language, loadWorkbook, syncPersistedMetadata, syncRecentFiles]);

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
        }
        await syncRecentFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Delete failed.';
        window.alert(t(language, 'deleteFailed', { message }));
      }
    })();
  }, [backendWorkbookId, language, syncRecentFiles]);

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
          onLanguageChange={setLanguage}
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
          onOpenRecentFile={handleOpenRecentFile}
          onDownloadRecentFile={handleDownloadRecentFile}
          onRenameRecentFile={handleRenameRecentFile}
          onDeleteRecentFile={handleDeleteRecentFile}
        />
      ) : (
        <SpreadsheetScreen
          language={language}
          onLanguageChange={setLanguage}
          workbookStore={workbookStore}
          title={resolvedTitle}
          storageSaving={storageSaving}
          onGoHome={() => setScreen('home')}
          onSave={handleSave}
          onRenameTitle={setTitle}
        />
      )}
    </>
  );
}

export default App;
