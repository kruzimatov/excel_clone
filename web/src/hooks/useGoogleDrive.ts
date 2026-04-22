import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FileDescriptor } from '../types';
import { loadDriveFolderId, saveDriveFolderId } from '../utils/localStorage';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const DEFAULT_FOLDER_NAME = 'Excel Clone Files';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
        };
      };
    };
  }
}

interface TokenResponse {
  access_token?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
}

interface TokenClient {
  callback: (response: TokenResponse) => void;
  requestAccessToken: (options?: { prompt?: '' | 'consent' }) => void;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

type DriveStatus =
  | 'missing-config'
  | 'loading'
  | 'ready'
  | 'connecting'
  | 'connected'
  | 'error';

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildMultipartBody(metadata: Record<string, unknown>, blob: Blob) {
  const boundary = `excel-clone-${Math.random().toString(36).slice(2)}`;
  const delimiter = `--${boundary}\r\n`;
  const closing = `--${boundary}--`;

  const body = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    '\r\n',
    delimiter,
    `Content-Type: ${blob.type || XLSX_MIME_TYPE}\r\n\r\n`,
    blob,
    '\r\n',
    closing,
  ], { type: `multipart/related; boundary=${boundary}` });

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

async function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gsi="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });
}

export function useGoogleDrive() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const folderName = (
    import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_NAME as string | undefined
  ) || DEFAULT_FOLDER_NAME;

  const configured = !!clientId;
  const [status, setStatus] = useState<DriveStatus>(configured ? 'loading' : 'missing-config');
  const [error, setError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(() => loadDriveFolderId());
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [busy, setBusy] = useState(false);

  const tokenClientRef = useRef<TokenClient | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const tokenExpiresAtRef = useRef<number>(0);

  useEffect(() => {
    if (!configured || !clientId) return;

    let cancelled = false;

    async function prepare() {
      try {
        await loadGoogleScript();
        if (cancelled) return;

        tokenClientRef.current = window.google?.accounts.oauth2.initTokenClient({
          client_id: clientId!,
          scope: DRIVE_SCOPE,
          callback: () => {},
        }) ?? null;

        setStatus(tokenClientRef.current ? 'ready' : 'error');
        if (!tokenClientRef.current) {
          setError('Google Drive authorization could not be initialized.');
        }
      } catch (loadError) {
        if (!cancelled) {
          setStatus('error');
          setError(loadError instanceof Error ? loadError.message : 'Drive setup failed.');
        }
      }
    }

    void prepare();

    return () => {
      cancelled = true;
    };
  }, [clientId, configured]);

  const requestAccessToken = useCallback(async (interactive: boolean) => {
    if (!configured) {
      throw new Error('Google Drive is not configured. Add VITE_GOOGLE_CLIENT_ID first.');
    }

    if (
      accessTokenRef.current
      && tokenExpiresAtRef.current > Date.now() + 60_000
    ) {
      return accessTokenRef.current;
    }

    if (!tokenClientRef.current) {
      throw new Error('Google Drive authorization is not ready yet.');
    }

    setStatus('connecting');
    setError(null);

    const token = await new Promise<string>((resolve, reject) => {
      tokenClientRef.current!.callback = (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google Drive authorization failed.'));
          return;
        }

        accessTokenRef.current = response.access_token;
        tokenExpiresAtRef.current = Date.now() + Number(response.expires_in ?? 3600) * 1000;
        resolve(response.access_token);
      };

      tokenClientRef.current!.requestAccessToken({
        prompt: interactive || !accessTokenRef.current ? 'consent' : '',
      });
    });

    setStatus('connected');
    return token;
  }, [configured]);

  const driveRequest = useCallback(async <T,>(
    token: string,
    input: string,
    init?: RequestInit,
  ): Promise<T> => {
    const response = await fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Drive request failed (${response.status}).`);
    }

    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  }, []);

  const ensureAppFolder = useCallback(async (interactive = true) => {
    const token = await requestAccessToken(interactive);
    setBusy(true);

    try {
      if (folderId) {
        try {
          const existing = await driveRequest<{ id: string; name: string }>(
            token,
            `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`,
          );
          setFolderId(existing.id);
          saveDriveFolderId(existing.id);
          return existing.id;
        } catch {
          setFolderId(null);
          saveDriveFolderId(null);
        }
      }

      const query = encodeURIComponent(
        `name='${escapeDriveQuery(folderName)}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`,
      );
      const existing = await driveRequest<{ files?: GoogleDriveFile[] }>(
        token,
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime,parents)&pageSize=10`,
      );

      const match = existing.files?.[0];
      if (match?.id) {
        setFolderId(match.id);
        saveDriveFolderId(match.id);
        return match.id;
      }

      const created = await driveRequest<{ id: string }>(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: FOLDER_MIME_TYPE,
        }),
      });

      setFolderId(created.id);
      saveDriveFolderId(created.id);
      return created.id;
    } finally {
      setBusy(false);
    }
  }, [driveRequest, folderId, folderName, requestAccessToken]);

  const refreshFiles = useCallback(async (interactive = true) => {
    const token = await requestAccessToken(interactive);
    const appFolderId = await ensureAppFolder(interactive);
    setBusy(true);

    try {
      const query = encodeURIComponent(
        `'${appFolderId}' in parents and trashed=false and mimeType!='${FOLDER_MIME_TYPE}'`,
      );
      const result = await driveRequest<{ files?: GoogleDriveFile[] }>(
        token,
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime,webViewLink,parents)&orderBy=modifiedTime desc&pageSize=50`,
      );

      setFiles(result.files ?? []);
      setStatus('connected');
      return result.files ?? [];
    } finally {
      setBusy(false);
    }
  }, [driveRequest, ensureAppFolder, requestAccessToken]);

  const openFile = useCallback(async (fileId: string) => {
    const token = await requestAccessToken(true);
    setBusy(true);

    try {
      const metadata = await driveRequest<GoogleDriveFile>(
        token,
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,parents`,
      );

      const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!fileResponse.ok) {
        throw new Error(`Could not download "${metadata.name}".`);
      }

      const blob = await fileResponse.blob();

      return {
        file: metadata,
        blob,
      };
    } finally {
      setBusy(false);
    }
  }, [driveRequest, requestAccessToken]);

  const saveFile = useCallback(async (input: {
    blob: Blob;
    name: string;
    existingFile?: FileDescriptor | null;
  }) => {
    const token = await requestAccessToken(true);
    const appFolderId = await ensureAppFolder(true);
    setBusy(true);

    try {
      const metadata: Record<string, unknown> = {
        name: input.name,
        mimeType: XLSX_MIME_TYPE,
      };

      if (!input.existingFile?.fileId) {
        metadata.parents = [appFolderId];
      }

      const multipart = buildMultipartBody(metadata, input.blob);
      const method = input.existingFile?.fileId ? 'PATCH' : 'POST';
      const target = input.existingFile?.fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${input.existingFile.fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,parents`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,parents';

      const saved = await driveRequest<GoogleDriveFile>(token, target, {
        method,
        headers: {
          'Content-Type': multipart.contentType,
        },
        body: multipart.body,
      });

      await refreshFiles(false);

      return {
        source: 'google-drive' as const,
        name: saved.name,
        fileId: saved.id,
        driveFolderId: saved.parents?.[0] ?? appFolderId,
        mimeType: saved.mimeType,
        modifiedAt: saved.modifiedTime,
        lastOpenedAt: new Date().toISOString(),
      };
    } finally {
      setBusy(false);
    }
  }, [driveRequest, ensureAppFolder, refreshFiles, requestAccessToken]);

  const state = useMemo(() => ({
    configured,
    status,
    error,
    files,
    folderId,
    folderName,
    busy,
    isConnected: status === 'connected',
  }), [busy, configured, error, files, folderId, folderName, status]);

  return {
    ...state,
    connect: refreshFiles,
    refreshFiles,
    ensureAppFolder,
    openFile,
    saveFile,
  };
}
