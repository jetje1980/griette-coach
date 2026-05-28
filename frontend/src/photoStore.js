// IndexedDB voor progressiefoto's — per datum en type (voor/zij/achter)
const DB_NAME = 'gc_photos';
const STORE = 'photos';
const VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      // Verwijder oude store als die bestaat (v1 had keyPath: 'date')
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export const photoStore = {
  async save(date, type, base64, mimeType) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        id: `${date}_${type}`,
        date, type, base64, mimeType,
        savedAt: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        // Groepeer per datum
        const byDate = {};
        for (const p of req.result) {
          if (!byDate[p.date]) byDate[p.date] = {};
          byDate[p.date][p.type] = p;
        }
        // Sorteer datum aflopend
        const sorted = Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, views]) => ({ date, views }));
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async delete(date, type) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(`${date}_${type}`);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
};
