// IndexedDB voor workout-screenshots (Garmin/Strava/Apple/…).
// Alleen bewaard als de gebruiker dat wil; gekoppeld aan WorkoutResult via sourceImageIds.

import { uploadMedia, downloadMedia, deleteMedia } from './mediaStore';

const DB_NAME = 'gc_workout_imgs';
const STORE = 'images';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export const workoutImages = {
  // Lokaal opslaan voor snelheid, daarna naar private cloudopslag met readback.
  async save(base64, mimeType) {
    const db = await openDB();
    const id = `wi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rec = { id, base64, mimeType, savedAt: new Date().toISOString() };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    const path = await uploadMedia('workouts', id, base64, mimeType);
    if (path) {
      const db2 = await openDB();
      await new Promise(res => {
        const tx = db2.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ ...rec, cloudPath: path, migrated: true });
        tx.oncomplete = res; tx.onerror = res;
      });
    }
    return id;
  },

  // Nog niet geüploade screenshots alsnog naar de cloud brengen.
  // Lokale bestanden worden nooit verwijderd zonder geslaagde readback.
  async migrateToCloud() {
    try {
      const db = await openDB();
      const all = await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error);
      });
      let uploaded = 0;
      for (const rec of all) {
        if (rec.cloudPath) continue;
        const path = await uploadMedia('workouts', rec.id, rec.base64, rec.mimeType);
        if (!path) continue;
        const dbw = await openDB();
        await new Promise(res => {
          const tx = dbw.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({ ...rec, cloudPath: path, migrated: true });
          tx.oncomplete = res; tx.onerror = res;
        });
        uploaded++;
      }
      return uploaded;
    } catch (e) {
      console.warn('Screenshot-migratie mislukt:', e.message);
      return 0;
    }
  },
  // Lokaal eerst; ontbreekt het bestand (ander toestel), dan uit de cloud.
  async get(id) {
    const db = await openDB();
    const local = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (local) return local;
    const { mediaPath } = await import('./mediaStore');
    const path = await mediaPath('workouts', id, 'image/jpeg');
    if (!path) return null;
    const blob = await downloadMedia(path);
    return blob ? { id, ...blob, cloudPath: path } : null;
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

// Bestand → base64 (max ~1600px zodat AI-extractie leesbaar blijft, jpeg)
export function fileToWorkoutImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
