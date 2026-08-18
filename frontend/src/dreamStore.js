// IndexedDB voor Dream Board afbeeldingen (Leven → Toekomst).
// Eigen afbeeldingen per domein (body/style/sport/work/money/freedom), max 3 per domein.

import { uploadMedia, downloadMedia, deleteMedia, listMedia } from './mediaStore';

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
  // Opslaan: eerst lokaal (snel zichtbaar), daarna naar private cloudopslag.
  // Het cloudpad wordt pas bewaard nadat de readback is geslaagd.
  async save(domain, base64, mimeType) {
    const db = await openDB();
    const id = `${domain}_${Date.now()}`;
    const record = { id, domain, base64, mimeType, savedAt: new Date().toISOString() };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    const path = await uploadMedia('dreamboard', id, base64, mimeType);
    if (path) {
      const db2 = await openDB();
      await new Promise((resolve) => {
        const tx = db2.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ ...record, cloudPath: path, migrated: true });
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }
    return id;
  },

  // Ontbrekende afbeeldingen uit de cloud terughalen (ander toestel/cache-clear)
  // en lokale afbeeldingen zonder cloudkopie alsnog uploaden.
  async syncWithCloud() {
    try {
      const db = await openDB();
      const local = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      const localById = new Map(local.map(r => [r.id, r]));

      // 1. Omhoog: lokale items die nog geen geverifieerde cloudkopie hebben
      for (const rec of local) {
        if (rec.cloudPath) continue;
        const path = await uploadMedia('dreamboard', rec.id, rec.base64, rec.mimeType);
        if (path) {
          const dbw = await openDB();
          await new Promise(res => {
            const tx = dbw.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ ...rec, cloudPath: path, migrated: true });
            tx.oncomplete = res; tx.onerror = res;
          });
        }
      }

      // 2. Omlaag: cloudbestanden die lokaal ontbreken
      let restored = 0;
      for (const item of await listMedia('dreamboard')) {
        if (localById.has(item.id)) continue;
        const blob = await downloadMedia(item.path);
        if (!blob) continue;
        const domain = item.id.split('_')[0];
        const dbw = await openDB();
        await new Promise(res => {
          const tx = dbw.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({
            id: item.id, domain, base64: blob.base64, mimeType: blob.mimeType,
            cloudPath: item.path, migrated: true, savedAt: new Date().toISOString(),
          });
          tx.oncomplete = res; tx.onerror = res;
        });
        restored++;
      }
      return restored;
    } catch (e) {
      console.warn('Dream Board cloudsync mislukt:', e.message);
      return 0;
    }
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
    const rec = await new Promise(res => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => res(req.result); req.onerror = () => res(null);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    if (rec?.cloudPath) await deleteMedia(rec.cloudPath);
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
