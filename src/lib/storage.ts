import type { IconRecord } from "../types";

export const STORAGE_KEY = "vibeicons.v1";

const DB_NAME = "vibeicons";
const STORE = "kv";

export function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export function loadIconsFromDb(db: IDBDatabase): Promise<IconRecord[] | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get("icons");
      r.onsuccess = () => {
        const v = r.result;
        if (Array.isArray(v) && v.length) resolve(v as IconRecord[]);
        else resolve(null);
      };
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function saveIconsToDb(db: IDBDatabase | null, list: IconRecord[]): void {
  if (db) {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(list, "icons");
      return;
    } catch (e) {
      console.warn("IDB save failed", e);
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY + ".icons", JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage quota exceeded — icons not persisted", e);
    try {
      localStorage.removeItem(STORAGE_KEY + ".icons");
    } catch {
      /* ignore */
    }
  }
}

export function deleteIconsFromDb(db: IDBDatabase | null): void {
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete("icons");
  } catch {
    /* ignore */
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function clearAllStorage(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_KEY))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
