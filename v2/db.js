// Ticket storage on IndexedDB.
// Unlike localStorage (~5MB, strings only), IndexedDB stores images as Blobs
// and can use a large share of the device's free disk, so tickets are
// effectively unlimited.

const TicketDB = (() => {
  const DB_NAME = 'tm-wallet';
  const DB_VERSION = 2;
  const STORE = 'events';
  const SETTINGS = 'settings';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('startAt', 'startAt');
        }
        if (!db.objectStoreNames.contains(SETTINGS)) {
          db.createObjectStore(SETTINGS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(mode, fn, storeName = STORE) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      let result;
      Promise.resolve(fn(store)).then(r => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transaction aborted'));
    });
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    all: () => tx('readonly', s => reqToPromise(s.getAll())),
    get: id => tx('readonly', s => reqToPromise(s.get(id))),
    put: event => tx('readwrite', s => { s.put(event); return event; }),
    putMany: events => tx('readwrite', s => { events.forEach(e => s.put(e)); return events.length; }),
    remove: id => tx('readwrite', s => { s.delete(id); }),
    clear: () => tx('readwrite', s => { s.clear(); }),
    getSetting: key => tx('readonly', s => reqToPromise(s.get(key)), SETTINGS).then(r => (r ? r.value : undefined)),
    setSetting: (key, value) => tx('readwrite', s => { s.put({ key, value }); }, SETTINGS),
    removeSetting: key => tx('readwrite', s => { s.delete(key); }, SETTINGS),
  };
})();

// Ask the browser not to evict our data when the device is low on space.
async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch (_) {}
  return false;
}

async function storageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      return await navigator.storage.estimate();
    }
  } catch (_) {}
  return null;
}

// Resize and compress an uploaded image so each ticket stays small.
async function compressImage(file, maxWidth = 1280, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read image'));
      i.src = url;
    });
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    return blob || file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataURL) {
  const res = await fetch(dataURL);
  return res.blob();
}
