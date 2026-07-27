// IndexedDB voor progressiefoto's — per datum en type (voor/zij/achter)
// Cloud backup via Supabase Storage (progress-photos bucket)
import { createClient } from '@supabase/supabase-js';

const DB_NAME = 'gc_photos';
const STORE = 'photos';
const VERSION = 2;
const BUCKET = 'progress-photos';

const supabase = createClient(
  'https://osuqtfsxmquwqsbgzlqn.supabase.co',
  'sb_publishable_6T-JJKX10RgLkWGwBwYaxg_gFANhdHS'
);

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

function b64toBlob(base64, mimeType) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

async function uploadToCloud(date, type, base64, mimeType) {
  try {
    const blob = b64toBlob(base64, mimeType);
    const ext = mimeType.split('/')[1] || 'jpg';
    const path = `${date}/${type}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: mimeType,
    });
    if (error) console.warn('Foto upload mislukt:', error.message);
  } catch (e) {
    console.warn('Foto upload fout:', e.message);
  }
}

async function deleteFromCloud(date, type) {
  try {
    // Try common extensions
    const paths = [`${date}/${type}.jpg`, `${date}/${type}.jpeg`, `${date}/${type}.png`, `${date}/${type}.webp`];
    await supabase.storage.from(BUCKET).remove(paths);
  } catch (e) {
    console.warn('Foto delete fout:', e.message);
  }
}

export const photoStore = {
  async save(date, type, base64, mimeType) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        id: `${date}_${type}`,
        date, type, base64, mimeType,
        savedAt: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    // Upload to cloud in background (non-blocking)
    uploadToCloud(date, type, base64, mimeType);
  },

  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const byDate = {};
        for (const p of req.result) {
          if (!byDate[p.date]) byDate[p.date] = {};
          byDate[p.date][p.type] = p;
        }
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
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(`${date}_${type}`);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    deleteFromCloud(date, type);
  },

  // Restore photos from cloud that are missing in IndexedDB
  async restoreFromCloud() {
    try {
      const { data: files, error } = await supabase.storage.from(BUCKET).list('', {
        limit: 500,
        sortBy: { column: 'name', order: 'desc' },
      });
      if (error || !files?.length) return 0;

      const db = await openDB();
      const existing = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAllKeys();
        req.onsuccess = () => resolve(new Set(req.result));
        req.onerror = () => reject(req.error);
      });

      let restored = 0;
      for (const folder of files) {
        if (folder.id) continue; // skip files at root, only process date-folders (id === null)
        const { data: photos } = await supabase.storage.from(BUCKET).list(folder.name);
        if (!photos) continue;
        for (const file of photos) {
          const type = file.name.replace(/\.[^.]+$/, '');
          const id = `${folder.name}_${type}`;
          if (existing.has(id)) continue;

          const { data: blob } = await supabase.storage.from(BUCKET).download(`${folder.name}/${file.name}`);
          if (!blob) continue;

          const base64 = await new Promise(res => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });

          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({
              id,
              date: folder.name,
              type,
              base64,
              mimeType: blob.type || 'image/jpeg',
              savedAt: new Date().toISOString(),
            });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
          });
          restored++;
        }
      }
      return restored;
    } catch (e) {
      console.warn('Foto restore mislukt:', e.message);
      return 0;
    }
  },
};
