// Hands files picked on the homepage to a tool page in the same browser, via IndexedDB.
// Nothing leaves the device; the entry is deleted as soon as the tool page reads it.

const DB = 'pagefold';
const STORE = 'handoff';
const MAX_AGE = 10 * 60 * 1000;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && out.result);
    t.onerror = () => reject(t.error);
  });
}

export async function putFiles(files) {
  const db = await open();
  try { await tx(db, 'readwrite', (s) => s.put({ files: [...files], at: Date.now() }, 'files')); } finally { db.close(); }
}

export async function takeFiles() {
  let db;
  try {
    db = await open();
    const entry = await tx(db, 'readonly', (s) => s.get('files'));
    await tx(db, 'readwrite', (s) => s.delete('files'));
    if (!entry || Date.now() - entry.at > MAX_AGE) return [];
    return entry.files || [];
  } catch {
    return [];
  } finally {
    if (db) db.close();
  }
}
