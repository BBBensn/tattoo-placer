const DB_NAME = 'tattoo-placer';
const DB_VERSION = 1;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('images')) d.createObjectStore('images', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('compositions')) d.createObjectStore('compositions', { keyPath: 'name' });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function run(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveImage = (id, blob, name) => run('images', 'readwrite', s => s.put({ id, blob, name }));
export const getImage = (id) => run('images', 'readonly', s => s.get(id));
export const deleteImage = (id) => run('images', 'readwrite', s => s.delete(id));
export const listImages = () => getAll('images');

export const saveComposition = (comp) => run('compositions', 'readwrite', s => s.put(comp));
export const getComposition = (name) => run('compositions', 'readonly', s => s.get(name));
export const deleteComposition = (name) => run('compositions', 'readwrite', s => s.delete(name));
export const listCompositions = () => getAll('compositions');
