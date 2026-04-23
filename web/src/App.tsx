import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import { HomeScreen } from './components/HomeScreen';
import { SpreadsheetScreen } from './components/SpreadsheetScreen';
import { createDefaultWorkbook, useWorkbook } from './store/useWorkbook';
import type { FileDescriptor, RecentFileEntry } from './types';
import { loadWorkbookFromAppsScript } from './utils/appScript';
import {
  canReadFileHandle,
  loadRecentFileHandle,
  pickWorkbookFileWithHandle,
  saveRecentFileHandle,
  supportsPersistentLocalFiles,
} from './utils/fileHandles';
import {
  loadRecentFiles,
  loadWorkbookDraft,
  saveRecentFile,
  saveWorkbookDraft,
  type StoredWorkbookDraft,
} from './utils/localStorage';
import {
  baseNameNoExt,
  buildWorkbookBlob,
  downloadWorkbookFile,
  importWorkbookFromFile,
  sanitizeFileName,
} from './utils/workbookXlsx';

type Screen = 'home' | 'editor';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function createDeviceHandleId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `device-handle:${crypto.randomUUID()}`;
  }
  return `device-handle:${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildDraftSummary(draft: StoredWorkbookDraft | null) {
  if (!draft) return null;
  return {
    title: draft.title,
    savedAt: draft.savedAt,
    currentFileName: draft.currentFileName,
  };
}

function buildWorkbookFileName(currentFileName: string | null, title: string) {
  const suggested = currentFileName
    || sanitizeFileName(`${title || 'Workbook'}.xlsx`)
    || `Workbook-${Date.now()}.xlsx`;
  return suggested.endsWith('.xlsx') ? suggested : `${suggested}.xlsx`;
}

function App() {
  const workbookStore = useWorkbook();
  const loadWorkbook = workbookStore.loadWorkbook;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;

  const [screen, setScreen] = useState<Screen>('home');
  const [title, setTitle] = useState('Hisobot');
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<FileDescriptor | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof buildDraftSummary>>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(() => loadRecentFiles());
  const [storageReady, setStorageReady] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [appScriptLoading, setAppScriptLoading] = useState(false);
  const [appScriptError, setAppScriptError] = useState<string | null>(null);
  const [appScriptSheetNames, setAppScriptSheetNames] = useState<string[]>([]);

  const rememberRecent = useCallback((entry: Omit<RecentFileEntry, 'id' | 'lastOpenedAt'> & { id?: string }) => {
    setRecentFiles(saveRecentFile(entry));
  }, []);

  const applySession = useCallback((input: {
    nextTitle: string;
    nextFileName: string | null;
    nextActiveFile: FileDescriptor | null;
    navigateTo?: Screen;
  }) => {
    setTitle(input.nextTitle);
    setCurrentFileName(input.nextFileName);
    setActiveFile(input.nextActiveFile);
    if (input.navigateTo) {
      setScreen(input.navigateTo);
    }
  }, []);

  const openWorkbookFromDeviceFile = useCallback(async (input: {
    file: File;
    fileHandleId?: string;
  }) => {
    const importedWorkbook = await importWorkbookFromFile(input.file);
    const safeName = sanitizeFileName(input.file.name);
    const descriptor: FileDescriptor = {
      source: 'device',
      name: safeName,
      fileHandleId: input.fileHandleId,
      mimeType: input.file.type || XLSX_MIME_TYPE,
      modifiedAt: new Date(input.file.lastModified || Date.now()).toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };

    workbookStore.loadWorkbook(importedWorkbook);
    setAppScriptError(null);
    setAppScriptSheetNames(importedWorkbook.sheets.map((sheet) => sheet.name));
    applySession({
      nextTitle: baseNameNoExt(input.file.name) || 'Workbook',
      nextFileName: safeName,
      nextActiveFile: descriptor,
      navigateTo: 'editor',
    });
    rememberRecent({
      id: input.fileHandleId ?? undefined,
      source: 'device',
      name: safeName,
      fileHandleId: input.fileHandleId,
      title: baseNameNoExt(input.file.name) || 'Workbook',
      currentFileName: safeName,
      mimeType: descriptor.mimeType,
      modifiedAt: descriptor.modifiedAt,
    });
  }, [applySession, rememberRecent, workbookStore]);

  const loadFromAppScript = useCallback(async () => {
    if (!appScriptUrl) {
      setAppScriptError('Add VITE_APPS_SCRIPT_URL in web/.env.local first.');
      return;
    }

    setAppScriptLoading(true);
    setAppScriptError(null);

    try {
      const remote = await loadWorkbookFromAppsScript(appScriptUrl);
      const descriptor: FileDescriptor = {
        source: 'appscript',
        name: remote.title,
        mimeType: 'application/json',
        modifiedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      };

      workbookStore.loadWorkbook(remote.workbook);
      setAppScriptSheetNames(remote.workbook.sheets.map((sheet) => sheet.name));
      applySession({
        nextTitle: remote.title,
        nextFileName: `${remote.title}.appscript`,
        nextActiveFile: descriptor,
        navigateTo: 'editor',
      });
      rememberRecent({
        id: `appscript:${remote.title}`,
        source: 'appscript',
        name: remote.title,
        title: remote.title,
        currentFileName: `${remote.title}.appscript`,
        mimeType: 'application/json',
        modifiedAt: descriptor.modifiedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apps Script load failed.';
      setAppScriptError(message);
      window.alert(`Apps Script load failed: ${message}`);
    } finally {
      setAppScriptLoading(false);
    }
  }, [appScriptUrl, applySession, rememberRecent, workbookStore]);

  useEffect(() => {
    let cancelled = false;

    async function restoreDraft() {
      const savedDraft = await loadWorkbookDraft();
      if (cancelled) return;

      if (savedDraft) {
        loadWorkbook(savedDraft.workbook);
        setTitle(savedDraft.title || 'Hisobot');
        setCurrentFileName(savedDraft.currentFileName);
        setActiveFile(savedDraft.activeFile);
        setDraft(buildDraftSummary(savedDraft));
        setAppScriptSheetNames(savedDraft.workbook.sheets.map((sheet) => sheet.name));
      }

      setStorageReady(true);
    }

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [loadWorkbook]);

  useEffect(() => {
    if (!storageReady) return undefined;

    const timeoutId = window.setTimeout(() => {
      try {
        const savedDraft = saveWorkbookDraft({
          workbook: workbookStore.workbook,
          title,
          currentFileName,
          activeFile,
        });
        setDraft(buildDraftSummary(savedDraft));
      } catch (error) {
        console.warn('Failed to save workbook draft', error);
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [activeFile, currentFileName, storageReady, title, workbookStore.workbook]);

  const handleCreateBlank = useCallback(() => {
    const nextWorkbook = createDefaultWorkbook();
    workbookStore.loadWorkbook(nextWorkbook);
    setAppScriptError(null);
    setAppScriptSheetNames(nextWorkbook.sheets.map((sheet) => sheet.name));
    applySession({
      nextTitle: 'Untitled spreadsheet',
      nextFileName: 'Untitled spreadsheet.xlsx',
      nextActiveFile: null,
      navigateTo: 'editor',
    });
  }, [applySession, workbookStore]);

  const handleResumeDraft = useCallback(() => {
    setScreen('editor');
  }, []);

  const handleOpenFromDevice = useCallback(() => {
    void (async () => {
      if (supportsPersistentLocalFiles()) {
        try {
          const picked = await pickWorkbookFileWithHandle();
          if (picked) {
            const handleId = createDeviceHandleId();
            await saveRecentFileHandle(handleId, picked.handle);
            await openWorkbookFromDeviceFile({
              file: picked.file,
              fileHandleId: handleId,
            });
            return;
          }
        } catch (error) {
          console.warn('File System Access API open failed, falling back to input picker.', error);
        }
      }

      fileInputRef.current?.click();
    })();
  }, [openWorkbookFromDeviceFile]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await openWorkbookFromDeviceFile({ file });
    } catch (error) {
      window.alert(`Open failed: ${String(error)}`);
    } finally {
      event.target.value = '';
    }
  }, [openWorkbookFromDeviceFile]);

  const handleSave = useCallback(() => {
    setLocalSaving(true);
    try {
      const savedDraft = saveWorkbookDraft({
        workbook: workbookStore.workbook,
        title,
        currentFileName,
        activeFile,
      });
      setDraft(buildDraftSummary(savedDraft));
    } catch (error) {
      window.alert(`Save failed: ${String(error)}`);
    } finally {
      setLocalSaving(false);
    }
  }, [activeFile, currentFileName, title, workbookStore.workbook]);

  const handleSaveAs = useCallback(() => {
    setLocalSaving(true);

    try {
      const fileName = buildWorkbookFileName(currentFileName, title);
      const blob = buildWorkbookBlob(workbookStore.workbook);
      downloadWorkbookFile(blob, fileName);

      const descriptor: FileDescriptor = {
        source: 'device',
        name: fileName,
        fileHandleId: activeFile?.source === 'device' ? activeFile.fileHandleId : undefined,
        mimeType: XLSX_MIME_TYPE,
        modifiedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      };

      applySession({
        nextTitle: baseNameNoExt(fileName) || title,
        nextFileName: fileName,
        nextActiveFile: descriptor,
      });
      rememberRecent({
        source: 'device',
        name: fileName,
        fileHandleId: descriptor.fileHandleId,
        title: baseNameNoExt(fileName) || title,
        currentFileName: fileName,
        mimeType: XLSX_MIME_TYPE,
        modifiedAt: descriptor.modifiedAt,
      });
    } catch (error) {
      window.alert(`Save As failed: ${String(error)}`);
    } finally {
      setLocalSaving(false);
    }
  }, [activeFile, applySession, currentFileName, rememberRecent, title, workbookStore.workbook]);

  const handleOpenRecentFile = useCallback((entry: RecentFileEntry) => {
    if (entry.source === 'appscript') {
      void loadFromAppScript();
      return;
    }

    if (entry.source === 'device' && entry.fileHandleId) {
      const handleId = entry.fileHandleId;
      void (async () => {
        try {
          const handle = await loadRecentFileHandle(handleId);
          if (!handle) {
            handleOpenFromDevice();
            return;
          }

          const granted = await canReadFileHandle(handle);
          if (!granted) {
            handleOpenFromDevice();
            return;
          }

          const file = await handle.getFile();
          await openWorkbookFromDeviceFile({
            file,
            fileHandleId: handleId,
          });
        } catch (error) {
          console.warn('Recent device reopen failed, falling back to picker.', error);
          handleOpenFromDevice();
        }
      })();
      return;
    }

    handleOpenFromDevice();
  }, [handleOpenFromDevice, loadFromAppScript, openWorkbookFromDeviceFile]);

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
          appScript={{
            configured: !!appScriptUrl,
            loading: appScriptLoading,
            error: appScriptError,
            sheetNames: appScriptSheetNames,
          }}
          onResumeDraft={handleResumeDraft}
          onCreateBlank={handleCreateBlank}
          onOpenFromDevice={handleOpenFromDevice}
          onLoadFromAppScript={() => void loadFromAppScript()}
          onOpenRecentFile={handleOpenRecentFile}
        />
      ) : (
        <SpreadsheetScreen
          workbookStore={workbookStore}
          title={title}
          currentFileName={currentFileName}
          activeFile={activeFile}
          localSaving={localSaving}
          remoteLoading={appScriptLoading}
          remoteConfigured={!!appScriptUrl}
          onGoHome={() => setScreen('home')}
          onOpenFromDevice={handleOpenFromDevice}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onLoadRemote={() => void loadFromAppScript()}
          onRenameTitle={setTitle}
        />
      )}
    </>
  );
}

export default App;
