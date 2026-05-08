import type { GroupMeta, IconRecord, SetMeta, SourceMeta } from "../types";
import { buildSearch, iconKey, rehydrateLegacyIcon } from "./icons";

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

function replScopedId(
  id: string | number | null,
  oldName: string,
  newName: string,
): string | number | null {
  if (id == null) return null;
  const s = String(id);
  const po = oldName + ":";
  if (!s.startsWith(po)) return id;
  return newName + ":" + s.slice(po.length);
}

/** Rename a library (source prefix on icons, sets, groups, source meta). */
export async function renameLibraryInDb(
  db: IDBDatabase,
  oldName: string,
  newName: string,
): Promise<void> {
  const prefix = oldName + ":";
  const icons = await getAllIcons(db);
  const iconDel: string[] = [];
  const iconPut: IconRecord[] = [];
  for (const ic of icons) {
    if (ic.source !== oldName) continue;
    const next: IconRecord = {
      ...ic,
      source: newName,
      set_id: replScopedId(ic.set_id, oldName, newName),
    };
    next.key = iconKey(next);
    next.search = buildSearch(next.name, next.tags, newName);
    iconDel.push(ic.key);
    iconPut.push(next);
  }

  const sets = await getAllSets(db);
  const setDel: Array<string | number> = [];
  const setPut: SetMeta[] = [];
  for (const s of sets) {
    if (!String(s.id).startsWith(prefix)) continue;
    setDel.push(s.id);
    setPut.push({
      ...s,
      id: replScopedId(s.id, oldName, newName)!,
      group_id: replScopedId(s.group_id, oldName, newName),
      label: s.label === oldName ? newName : s.label,
    });
  }

  const groups = await getAllGroups(db);
  const groupDel: Array<string | number> = [];
  const groupPut: GroupMeta[] = [];
  for (const g of groups) {
    if (!String(g.id).startsWith(prefix)) continue;
    groupDel.push(g.id);
    groupPut.push({
      ...g,
      id: replScopedId(g.id, oldName, newName)!,
      group_id: replScopedId(g.group_id, oldName, newName),
      label: g.label === oldName ? newName : g.label,
    });
  }

  const tx = db.transaction(
    [STORE_ICONS, STORE_SETS, STORE_GROUPS, STORE_SOURCES],
    "readwrite",
  );
  const is = tx.objectStore(STORE_ICONS);
  for (const k of iconDel) is.delete(k);
  for (const ic of iconPut) is.put(ic);

  const ss = tx.objectStore(STORE_SETS);
  for (const id of setDel) ss.delete(id);
  for (const s of setPut) ss.put(s);

  const gs = tx.objectStore(STORE_GROUPS);
  for (const id of groupDel) gs.delete(id);
  for (const g of groupPut) gs.put(g);

  const srcStore = tx.objectStore(STORE_SOURCES);
  srcStore.delete(oldName);
  srcStore.put({ name: newName, count: iconPut.length } satisfies SourceMeta);
  return txDone(tx);
}

/** Remove one imported library and its scoped sets/groups from IDB. */
export async function deleteLibraryFromDb(db: IDBDatabase, sourceName: string): Promise<void> {
  await deleteIconsBySource(db, sourceName);
  const prefix = sourceName + ":";
  const sets = await getAllSets(db);
  const groups = await getAllGroups(db);
  const tx = db.transaction([STORE_SETS, STORE_GROUPS, STORE_SOURCES], "readwrite");
  const ss = tx.objectStore(STORE_SETS);
  const gs = tx.objectStore(STORE_GROUPS);
  for (const s of sets) {
    if (String(s.id).startsWith(prefix)) ss.delete(s.id);
  }
  for (const g of groups) {
    if (String(g.id).startsWith(prefix)) gs.delete(g.id);
  }
  tx.objectStore(STORE_SOURCES).delete(sourceName);
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
