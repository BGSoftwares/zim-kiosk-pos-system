export interface OfflineOperation<T = unknown> {
  id: string;
  createdAt: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  payload: T;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'zim-kiosk-pos-offline';
const STORE_NAME = 'operations';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open offline database'));
  });
}

export async function enqueue<T>(operation: Omit<OfflineOperation<T>, 'status' | 'attempts'>) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...operation, status: 'pending', attempts: 0 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Unable to queue offline operation'));
  });
  db.close();
}

export async function listPending(): Promise<OfflineOperation[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as OfflineOperation[]).filter(item => item.status === 'pending' || item.status === 'failed'));
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error('Unable to read offline queue'));
    };
  });
}

export async function remove(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Unable to remove offline operation'));
  });
  db.close();
}
