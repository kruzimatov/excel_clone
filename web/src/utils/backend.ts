import type { FileDescriptor, Workbook } from '../types';

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
