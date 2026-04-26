import type { FileDescriptor, SheetRowChunk, Workbook } from '../types';

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

interface HealthResponse {
  status: string;
  database: string;
  message: string;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
    throw new Error(message);
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

export async function createWorkbookRecord(payload: PersistWorkbookPayload) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookRecord>>('/workbooks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateWorkbookRecord(id: string, payload: PersistWorkbookPayload) {
  const response = await fetchJson<ApiEnvelope<BackendWorkbookRecord>>(`/workbooks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return response.data;
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
