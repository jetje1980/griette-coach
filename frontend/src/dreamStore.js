// IndexedDB voor Dream Board afbeeldingen (Leven → Toekomst).
// Eigen afbeeldingen per domein (body/style/sport/work/money/freedom), max 3 per domein.

const DB_NAME = 'gc_dreams';
const STORE = 'images';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export const dreamStore = {
  // save één afbeelding voor een domein
  async save(domain, base64, mimeType) {
    const db = await openDB();
    const id = `${domain}_${Date.now()}`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, domain, base64, mimeType, savedAt: new Date().toISOString() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return id;
  },

  // alle afbeeldingen, gegroepeerd per domein (nieuwste eerst)
  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const byDomain = {};
        for (const img of req.result.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))) {
          if (!byDomain[img.domain]) byDomain[img.domain] = [];
          byDomain[img.domain].push(img);
        }
        resolve(byDomain);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
};

// Bestand → geschaalde base64 (max ~1200px, jpeg) zodat IndexedDB klein blijft
export function fileToDreamImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
