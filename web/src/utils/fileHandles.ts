declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
}

interface FilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerType[];
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandleLike {
  kind: string;
  queryPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandleLike {
  getFile: () => Promise<File>;
}

const DATABASE_NAME = 'excel-clone-web-file-handles';
const STORE_NAME = 'handles';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = handler(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      database.close();
    };
  }));
}

export function supportsPersistentLocalFiles() {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && typeof window.showOpenFilePicker === 'function'
    && typeof window.indexedDB !== 'undefined';
}

export async function pickWorkbookFileWithHandle() {
  if (!supportsPersistentLocalFiles() || !window.showOpenFilePicker) {
    return null;
  }

  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    excludeAcceptAllOption: false,
    types: [{
      description: 'Excel workbooks',
      accept: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      },
    }],
  });

  if (!handle) return null;

  const file = await handle.getFile();
  return { file, handle };
}

export async function saveRecentFileHandle(handleId: string, handle: FileSystemFileHandle) {
  await withStore('readwrite', (store) => store.put(handle, handleId));
}

export async function loadRecentFileHandle(handleId: string) {
  const handle = await withStore<FileSystemFileHandle | undefined>('readonly', (store) => store.get(handleId));
  return handle ?? null;
}

export async function canReadFileHandle(handle: FileSystemFileHandle) {
  if (typeof handle.queryPermission === 'function') {
    const current = await handle.queryPermission({ mode: 'read' });
    if (current === 'granted') return true;
  }

  if (typeof handle.requestPermission === 'function') {
    const next = await handle.requestPermission({ mode: 'read' });
    return next === 'granted';
  }

  return true;
}
