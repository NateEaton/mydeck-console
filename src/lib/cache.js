/**
 * @typedef {Object} CachedBookmark
 * @property {string} id
 * @property {string} url
 * @property {string} title
 * @property {string} created
 * @property {boolean} is_marked
 * @property {number} read_progress
 * @property {string[]} labels
 * @property {number} cachedAt - epoch ms
 */

const DB_NAME = 'mydeck-console';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

/** @returns {Promise<IDBDatabase>} */
export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('bookmarks')) {
        const store = db.createObjectStore('bookmarks', { keyPath: 'id' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });

  return dbPromise;
}

/**
 * @param {IDBDatabase} db
 * @param {string[]} storeNames
 * @param {IDBTransactionMode} mode
 * @returns {IDBTransaction}
 */
function tx(db, storeNames, mode) {
  return db.transaction(storeNames, mode);
}

/**
 * @param {IDBRequest} req
 * @returns {Promise<any>}
 */
function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * @param {object[]} bookmarks
 * @returns {Promise<void>}
 */
export async function putBookmarks(bookmarks) {
  const db = await openDB();
  const store = tx(db, ['bookmarks'], 'readwrite').objectStore('bookmarks');
  const now = Date.now();
  await Promise.all(
    bookmarks.map((b) => promisify(store.put({ ...b, cachedAt: now })))
  );
}

/**
 * @returns {Promise<CachedBookmark[]>}
 */
export async function getBookmarks() {
  const db = await openDB();
  const store = tx(db, ['bookmarks'], 'readonly').objectStore('bookmarks');
  const index = store.index('cachedAt');

  return new Promise((resolve, reject) => {
    const req = index.openCursor(null, 'prev');
    const results = [];
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * @param {string} id
 * @returns {Promise<CachedBookmark | undefined>}
 */
export async function getBookmark(id) {
  const db = await openDB();
  const store = tx(db, ['bookmarks'], 'readonly').objectStore('bookmarks');
  return promisify(store.get(id));
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBookmark(id) {
  const db = await openDB();
  const store = tx(db, ['bookmarks'], 'readwrite').objectStore('bookmarks');
  return promisify(store.delete(id));
}

/** @returns {Promise<void>} */
export async function clearBookmarks() {
  const db = await openDB();
  const store = tx(db, ['bookmarks'], 'readwrite').objectStore('bookmarks');
  return promisify(store.clear());
}

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getMeta(key) {
  const db = await openDB();
  const store = tx(db, ['meta'], 'readonly').objectStore('meta');
  const record = await promisify(store.get(key));
  return record?.value;
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function setMeta(key, value) {
  const db = await openDB();
  const store = tx(db, ['meta'], 'readwrite').objectStore('meta');
  return promisify(store.put({ key, value }));
}

/** @returns {Promise<Set<string>>} */
export async function getIgnoredIds() {
  const ids = (await getMeta('ignored')) ?? [];
  return new Set(ids);
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function ignoreBookmark(id) {
  const ids = (await getMeta('ignored')) ?? [];
  const set = new Set(ids);
  set.add(id);
  await setMeta('ignored', [...set]);
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function unignoreBookmark(id) {
  const ids = (await getMeta('ignored')) ?? [];
  const set = new Set(ids);
  set.delete(id);
  await setMeta('ignored', [...set]);
}

/** @returns {Promise<void>} */
export async function clearAll() {
  const db = await openDB();
  const t = db.transaction(['bookmarks', 'meta'], 'readwrite');
  await Promise.all([
    promisify(t.objectStore('bookmarks').clear()),
    promisify(t.objectStore('meta').clear()),
  ]);
}
