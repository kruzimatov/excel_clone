import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import { HomeScreen } from './components/HomeScreen';
import { SpreadsheetScreen } from './components/SpreadsheetScreen';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import { createDefaultWorkbook, useWorkbook } from './store/useWorkbook';
import type { FileDescriptor, RecentFileEntry } from './types';
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
  importWorkbookFromArrayBuffer,
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
  const drive = useGoogleDrive();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [screen, setScreen] = useState<Screen>('home');
  const [title, setTitle] = useState('Hisobot');
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<FileDescriptor | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof buildDraftSummary>>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(() => loadRecentFiles());
  const [storageReady, setStorageReady] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);

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
    workbookStore.loadWorkbook(createDefaultWorkbook());
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

  const handleConnectDrive = useCallback(async () => {
    try {
      await drive.connect(true);
    } catch (error) {
      window.alert(`Google Drive connection failed: ${String(error)}`);
    }
  }, [drive]);

  const handleOpenDriveFile = useCallback(async (fileId: string) => {
    try {
      const opened = await drive.openFile(fileId);
      const importedWorkbook = importWorkbookFromArrayBuffer(await opened.blob.arrayBuffer());
      const descriptor: FileDescriptor = {
        source: 'google-drive',
        name: opened.file.name,
        fileId: opened.file.id,
        driveFolderId: opened.file.parents?.[0],
        mimeType: opened.file.mimeType,
        modifiedAt: opened.file.modifiedTime,
        lastOpenedAt: new Date().toISOString(),
      };

      workbookStore.loadWorkbook(importedWorkbook);
      applySession({
        nextTitle: baseNameNoExt(opened.file.name) || 'Workbook',
        nextFileName: opened.file.name,
        nextActiveFile: descriptor,
        navigateTo: 'editor',
      });
      rememberRecent({
        id: `google-drive:${opened.file.id}`,
        source: 'google-drive',
        name: opened.file.name,
        fileId: opened.file.id,
        driveFolderId: opened.file.parents?.[0],
        mimeType: opened.file.mimeType,
        modifiedAt: opened.file.modifiedTime,
        title: baseNameNoExt(opened.file.name) || 'Workbook',
        currentFileName: opened.file.name,
      });
    } catch (error) {
      window.alert(`Google Drive open failed: ${String(error)}`);
    }
  }, [applySession, drive, rememberRecent, workbookStore]);

  const handleSaveToDrive = useCallback(async () => {
    setDriveSaving(true);

    try {
      const fileName = buildWorkbookFileName(currentFileName, title);
      const blob = buildWorkbookBlob(workbookStore.workbook);
      const savedFile = await drive.saveFile({
        blob,
        name: fileName,
        existingFile: activeFile?.source === 'google-drive' ? activeFile : null,
      });

      applySession({
        nextTitle: baseNameNoExt(savedFile.name) || title,
        nextFileName: savedFile.name,
        nextActiveFile: savedFile,
      });
      rememberRecent({
        id: `google-drive:${savedFile.fileId}`,
        source: 'google-drive',
        name: savedFile.name,
        fileId: savedFile.fileId,
        driveFolderId: savedFile.driveFolderId,
        mimeType: savedFile.mimeType,
        modifiedAt: savedFile.modifiedAt,
        title: baseNameNoExt(savedFile.name) || title,
        currentFileName: savedFile.name,
      });
    } catch (error) {
      window.alert(`Google Drive save failed: ${String(error)}`);
    } finally {
      setDriveSaving(false);
    }
  }, [activeFile, applySession, currentFileName, drive, rememberRecent, title, workbookStore.workbook]);

  const handleOpenRecentFile = useCallback((entry: RecentFileEntry) => {
    if (entry.source === 'google-drive' && entry.fileId) {
      void handleOpenDriveFile(entry.fileId);
      return;
    }

    if (entry.source === 'device' && entry.fileHandleId) {
      void (async () => {
        try {
          const handle = await loadRecentFileHandle(entry.fileHandleId!);
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
            fileHandleId: entry.fileHandleId,
          });
        } catch (error) {
          console.warn('Recent device reopen failed, falling back to picker.', error);
          handleOpenFromDevice();
        }
      })();
      return;
    }

    handleOpenFromDevice();
  }, [handleOpenDriveFile, handleOpenFromDevice, openWorkbookFromDeviceFile]);

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
          driveConfigured={drive.configured}
          driveConnected={drive.isConnected}
          driveBusy={drive.busy}
          driveFiles={drive.files}
          driveFolderName={drive.folderName}
          driveError={drive.error}
          onResumeDraft={handleResumeDraft}
          onCreateBlank={handleCreateBlank}
          onOpenFromDevice={handleOpenFromDevice}
          onConnectDrive={() => void handleConnectDrive()}
          onRefreshDrive={() => void drive.refreshFiles(true)}
          onOpenDriveFile={(fileId) => void handleOpenDriveFile(fileId)}
          onOpenRecentFile={handleOpenRecentFile}
        />
      ) : (
        <SpreadsheetScreen
          workbookStore={workbookStore}
          title={title}
          currentFileName={currentFileName}
          activeFile={activeFile}
          localSaving={localSaving}
          driveSaving={driveSaving}
          driveConfigured={drive.configured}
          driveConnected={drive.isConnected}
          onGoHome={() => setScreen('home')}
          onOpenFromDevice={handleOpenFromDevice}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onSaveToDrive={() => void handleSaveToDrive()}
          onConnectDrive={() => void handleConnectDrive()}
        />
      )}
    </>
  );
}

export default App;
