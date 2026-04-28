import type { FileDescriptor, SheetRowChunk, Workbook } from '../types';
import { getAuthHeader } from './auth';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export interface PersistWorkbookPayload {
  title: string;
  currentFileName: string | null;
  activeFile: FileDescriptor | null;
  workbook: Workbook;
}

export interface BackendWorkbookSummary {
  id: string;
  title: string;
  currentFileName: string | null;
  activeFile: FileDescriptor | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface BackendWorkbookRecord extends BackendWorkbookSummary {
  workbook: Workbook;
}

export interface BackendWorkbookMetadata extends BackendWorkbookSummary {
  workbook: Workbook;
  sheetStats: Array<{
    id: string;
    name: string;
    storedRowCount: number;
  }>;
}

export interface BackendWorkbookSheetRowsChunk {
  sheetId: string;
  sheetName: string;
  rows: SheetRowChunk[];
  nextAfterRow: number;
  nextBeforeRow?: number;
  totalStoredRows: number;
  done: boolean;
}

interface ChunkedSheetRowPayload {
  rowIndex: number;
  cells: Record<string, Workbook['sheets'][number]['cells'][string]>;
}

interface ChunkedSheetUploadPayload {
  position: number;
  sheet: {
    id: string;
    name: string;
    colWidths: Record<number, number>;
    rowHeights: Record<number, number>;
    visibleRowCount: number;
    visibleColumnCount: number;
  };
  rows: ChunkedSheetRowPayload[];
}

interface ApiEnvelope<T> {
  data: T;
}

export interface ExternalSyncServiceResult {
  skipped: boolean;
  reason?: string;
  error?: string;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
}

export interface ExternalSyncResult {
  appsScript?: ExternalSyncServiceResult;
  telegram?: ExternalSyncServiceResult;
}

interface SaveWorkbookEnvelope<T> extends ApiEnvelope<T> {
  integrations?: ExternalSyncResult | null;
}

interface HealthResponse {
  status: string;
  database: string;
  message: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const authorization = getAuthHeader();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // Keep the generic message when the response is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getStorageHealth() {
  return fetchJson<HealthResponse>('/health');
}

export async function listWorkbooks(limit = 20) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookSummary[]>>(`/workbooks?limit=${limit}`);
  return response.data;
}

export async function getWorkbook(id: string) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookRecord>>(`/workbooks/${id}`);
  return response.data;
}

export async function getWorkbookMetadata(id: string) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookMetadata>>(`/workbooks/${id}/meta`);
  return response.data;
}

export async function getWorkbookSheetRowsChunk(
  id: string,
  sheetId: string,
  options: {
    afterRow?: number;
    beforeRow?: number;
    direction?: 'asc' | 'desc';
    limit: number;
  },
) {
  const query = new URLSearchParams({
    limit: String(options.limit),
    direction: options.direction ?? 'asc',
  });
  if (options.afterRow !== undefined) {
    query.set('afterRow', String(options.afterRow));
  }
  if (options.beforeRow !== undefined) {
    query.set('beforeRow', String(options.beforeRow));
  }

  const response = await fetchJson<ApiEnvelope<BackendWorkbookSheetRowsChunk>>(
    `/workbooks/${id}/sheets/${encodeURIComponent(sheetId)}/rows?${query.toString()}`,
  );
  return response.data;
}

export async function createWorkbookRecord(payload: PersistWorkbookPayload, options?: { syncExternal?: boolean }) {
  const query = options?.syncExternal ? '?syncExternal=1' : '';
  const response = await fetchJson<SaveWorkbookEnvelope<BackendWorkbookRecord>>(`/workbooks${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    record: response.data,
    integrations: response.integrations ?? null,
  };
}

export async function updateWorkbookRecord(
  id: string,
  payload: PersistWorkbookPayload,
  options?: { syncExternal?: boolean },
) {
  const query = options?.syncExternal ? '?syncExternal=1' : '';
  const response = await fetchJson<SaveWorkbookEnvelope<BackendWorkbookRecord>>(`/workbooks/${id}${query}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return {
    record: response.data,
    integrations: response.integrations ?? null,
  };
}

export async function renameWorkbookRecord(id: string, title: string) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookRecord>>(`/workbooks/${id}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
  return response.data;
}

export async function deleteWorkbookRecord(id: string) {
  await fetchJson<void>(`/workbooks/${id}`, {
    method: 'DELETE',
  });
}

export async function beginChunkedWorkbookRecordSave(input: {
  id?: string | null;
  title: string;
  currentFileName: string | null;
  activeFile: FileDescriptor | null;
  activeSheetId: string;
}) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookSummary>>('/workbooks/chunked/init', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function uploadChunkedWorkbookSheet(
  workbookId: string,
  payload: ChunkedSheetUploadPayload,
) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookSummary>>(`/workbooks/${workbookId}/chunked-sheet`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function syncWorkbookRecord(workbookId: string) {
  const response = await fetchJson<ApiEnvelope<ExternalSyncResult>>(`/workbooks/${workbookId}/sync`, {
    method: 'POST',
  });
  return response.data;
}

export async function syncWorkbookToAppsScript(workbookId: string) {
  const response = await fetchJson<ApiEnvelope<ExternalSyncServiceResult>>(`/workbooks/${workbookId}/sync/apps-script`, {
    method: 'POST',
  });
  return response.data;
}
