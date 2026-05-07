import type { GroupMeta, IconRecord, SetMeta, SourceMeta } from "../types";
import { rehydrateLegacyIcon } from "./icons";

const DB_NAME = "vibeicons";
const DB_VERSION = 2;

export const STORE_ICONS = "icons";
export const STORE_SETS = "sets";
export const STORE_GROUPS = "groups";
export const STORE_SOURCES = "sources";
export const STORE_META = "meta";
const LEGACY_KV = "kv";

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export interface OpenDbResult {
  db: IDBDatabase;
  legacyIcons: IconRecord[] | null;
}

export function openDb(): Promise<OpenDbResult | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let pendingLegacy: IconRecord[] | null = null;

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction;

      if (!db.objectStoreNames.contains(STORE_ICONS)) {
        const s = db.createObjectStore(STORE_ICONS, { keyPath: "key" });
        s.createIndex("by_set", "set_id");
        s.createIndex("by_source", "source");
        s.createIndex("by_style", "style");
        s.createIndex("by_name", "name");
      }
      if (!db.objectStoreNames.contains(STORE_SETS)) {
        db.createObjectStore(STORE_SETS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_GROUPS)) {
        db.createObjectStore(STORE_GROUPS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SOURCES)) {
        db.createObjectStore(STORE_SOURCES, { keyPath: "name" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }

      // v1 → v2: pull legacy kv.icons array, stage for post-open migration
      if (event.oldVersion < 2 && tx && db.objectStoreNames.contains(LEGACY_KV)) {
        try {
          const kv = tx.objectStore(LEGACY_KV);
          const getReq = kv.get("icons");
          getReq.onsuccess = () => {
            const arr = getReq.result;
            if (Array.isArray(arr)) {
              pendingLegacy = arr
                .map((i) => rehydrateLegacyIcon(i))
                .filter((x): x is IconRecord => x !== null);
            }
          };
        } catch {
          /* ignore */
        }
      }
    };

    req.onsuccess = () => resolve({ db: req.result, legacyIcons: pendingLegacy });
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

export async function getAllIcons(db: IDBDatabase): Promise<IconRecord[]> {
  const tx = db.transaction(STORE_ICONS, "readonly");
  return (await reqToPromise(tx.objectStore(STORE_ICONS).getAll())) as IconRecord[];
}

export async function getAllSets(db: IDBDatabase): Promise<SetMeta[]> {
  const tx = db.transaction(STORE_SETS, "readonly");
  return (await reqToPromise(tx.objectStore(STORE_SETS).getAll())) as SetMeta[];
}

export async function getAllGroups(db: IDBDatabase): Promise<GroupMeta[]> {
  const tx = db.transaction(STORE_GROUPS, "readonly");
  return (await reqToPromise(tx.objectStore(STORE_GROUPS).getAll())) as GroupMeta[];
}

export async function getAllSources(db: IDBDatabase): Promise<SourceMeta[]> {
  const tx = db.transaction(STORE_SOURCES, "readonly");
  return (await reqToPromise(tx.objectStore(STORE_SOURCES).getAll())) as SourceMeta[];
}

export async function bulkPutIcons(db: IDBDatabase, icons: IconRecord[]): Promise<void> {
  if (!icons.length) return;
  const tx = db.transaction(STORE_ICONS, "readwrite");
  const store = tx.objectStore(STORE_ICONS);
  for (const i of icons) store.put(i);
  return txDone(tx);
}

export async function bulkPutSets(db: IDBDatabase, sets: SetMeta[]): Promise<void> {
  if (!sets.length) return;
  const tx = db.transaction(STORE_SETS, "readwrite");
  const store = tx.objectStore(STORE_SETS);
  for (const s of sets) store.put(s);
  return txDone(tx);
}

export async function bulkPutGroups(db: IDBDatabase, groups: GroupMeta[]): Promise<void> {
  if (!groups.length) return;
  const tx = db.transaction(STORE_GROUPS, "readwrite");
  const store = tx.objectStore(STORE_GROUPS);
  for (const g of groups) store.put(g);
  return txDone(tx);
}

export async function putSource(db: IDBDatabase, source: SourceMeta): Promise<void> {
  const tx = db.transaction(STORE_SOURCES, "readwrite");
  tx.objectStore(STORE_SOURCES).put(source);
  return txDone(tx);
}

export async function deleteIconsBySource(db: IDBDatabase, source: string): Promise<void> {
  const tx = db.transaction(STORE_ICONS, "readwrite");
  const store = tx.objectStore(STORE_ICONS);
  const idx = store.index("by_source");
  const cursorReq = idx.openCursor(IDBKeyRange.only(source));
  cursorReq.onsuccess = () => {
    const c = cursorReq.result;
    if (c) {
      c.delete();
      c.continue();
    }
  };
  return txDone(tx);
}

export async function clearAll(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(
    [STORE_ICONS, STORE_SETS, STORE_GROUPS, STORE_SOURCES, STORE_META],
    "readwrite",
  );
  tx.objectStore(STORE_ICONS).clear();
  tx.objectStore(STORE_SETS).clear();
  tx.objectStore(STORE_GROUPS).clear();
  tx.objectStore(STORE_SOURCES).clear();
  tx.objectStore(STORE_META).clear();
  return txDone(tx);
}

export async function getMeta<T>(db: IDBDatabase, key: string): Promise<T | null> {
  const tx = db.transaction(STORE_META, "readonly");
  const v = await reqToPromise(tx.objectStore(STORE_META).get(key));
  return (v as T) ?? null;
}

export async function setMeta<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put(value, key);
  return txDone(tx);
}
