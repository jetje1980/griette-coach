// IndexedDB voor progressiefoto's — per datum en type (voor/zij/achter)
// Cloud backup via Supabase Storage (progress-photos bucket)
import { supabase, getUserId } from './supabase';
import { mediaUploadStart, mediaUploadDone } from './sync';

const DB_NAME = 'gc_photos';
const STORE = 'photos';
const VERSION = 2;
const BUCKET = 'progress-photos';



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

// Nieuwe paden staan onder de gebruiker: {user_id}/progress/{datum}/{type}.ext
// Oude paden ({datum}/{type}.ext) blijven leesbaar tot ze gemigreerd zijn.
export async function userPrefix() {
  const uid = await getUserId();
  return uid ? `${uid}/progress` : null;
}

// Naar de cloud, en eerlijk over de afloop.
//
// Dit ging eerder mis op twee manieren tegelijk: de aanroeper wachtte niet
// op het resultaat, en een fout werd alleen naar de console geschreven. Een
// foto kon dus alleen op dit toestel staan zonder dat er iets van te zien
// was — precies het scenario waarin een gewiste telefoon hem meeneemt.
//
// Nu: de upload wordt afgewacht, de status gaat naar de centrale melding,
// en de uitkomst komt terug als { ok, path, reason }.
async function uploadToCloud(date, type, base64, mimeType) {
  const prefix = await userPrefix();
  if (!prefix) {
    return { ok: false, skipped: true, reason: 'niet ingelogd' };
  }
  const ext = mimeType.split('/')[1] || 'jpg';
  const path = `${prefix}/${date}/${type}.${ext}`;
  mediaUploadStart();
  try {
    const blob = b64toBlob(base64, mimeType);
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: mimeType,
    });
    if (error) throw error;
    // Teruglezen: een upload zonder readback is geen bewijs.
    const { error: readErr } = await supabase.storage.from(BUCKET)
      .list(`${prefix}/${date}`, { search: `${type}.${ext}` });
    if (readErr) throw readErr;
    mediaUploadDone(path, null);
    return { ok: true, path };
  } catch (e) {
    const reason = e?.message || String(e);
    mediaUploadDone(path, reason, `foto ${type} van ${date}`);
    return { ok: false, path, reason };
  }
}

async function deleteFromCloud(date, type) {
  try {
    const prefix = await userPrefix();
    const exts = ['jpg', 'jpeg', 'png', 'webp'];
    const paths = [
      ...(prefix ? exts.map(e => `${prefix}/${date}/${type}.${e}`) : []),
      ...exts.map(e => `${date}/${type}.${e}`),   // legacy pad
    ];
    await supabase.storage.from(BUCKET).remove(paths);
  } catch (e) {
    console.warn('Foto delete fout:', e.message);
  }
}

export async function checkPhotoCloud() {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1 });
    if (error) return { ok: false, reason: error.message };
    return { ok: true, folders: data?.length ?? 0 };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export const photoStore = {
  // meta: vrije beschrijvende velden (bron, afmetingen, oriëntatie). Ze
  // gaan mee de lokale opslag in zodat later te zien is waar een foto
  // vandaan kwam en hoe hij bewerkt is.
  async save(date, type, base64, mimeType, meta = {}) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        id: `${date}_${type}`,
        date, type, base64, mimeType,
        savedAt: new Date().toISOString(),
        ...meta,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    // Eerst lokaal (dan is hij nooit kwijt), daarna naar de cloud — en op
    // die cloud wachten we wél, zodat het scherm de waarheid kan tonen.
    const res = await uploadToCloud(date, type, base64, mimeType);
    if (res.ok) {
      const db2 = await openDB();
      await new Promise(done => {
        const tx = db2.transaction(STORE, 'readwrite');
        const st = tx.objectStore(STORE);
        const req = st.get(`${date}_${type}`);
        req.onsuccess = () => {
          if (req.result) st.put({ ...req.result, cloudOk: true, cloudPath: res.path });
        };
        tx.oncomplete = done; tx.onerror = done;
      });
    }
    return res;
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

  // Alles wat lokaal staat maar niet in de cloud, alsnog omhoog.
  // Dit is de tegenhanger van restoreFromCloud: die haalt op, deze brengt.
  // Draait bij het opstarten, zodat een foto die tijdens een slechte
  // verbinding is gemaakt niet op één toestel blijft hangen.
  async pushMissingToCloud() {
    const prefix = await userPrefix();
    if (!prefix) return { uploaded: 0, failed: 0, skipped: true };
    const db = await openDB();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    let uploaded = 0, failed = 0;
    for (const p of all) {
      if (p.cloudOk) continue;
      const r = await uploadToCloud(p.date, p.type, p.base64, p.mimeType || 'image/jpeg');
      if (r.ok) {
        uploaded++;
        await new Promise(res => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({ ...p, cloudOk: true, cloudPath: r.path });
          tx.oncomplete = res; tx.onerror = res;
        });
      } else if (!r.skipped) failed++;
    }
    return { uploaded, failed };
  },

  // Restore photos from cloud that are missing in IndexedDB
  async restoreFromCloud() {
    try {
      const prefix = await userPrefix();
      if (!prefix) return 0;               // niet ingelogd: niets ophalen
      // Nieuwe locatie eerst, daarna het legacy pad in de bucketroot
      const roots = [prefix, ''];
      let files = [];
      let root = prefix;
      for (const r of roots) {
        const { data, error } = await supabase.storage.from(BUCKET).list(r, {
          limit: 500, sortBy: { column: 'name', order: 'desc' },
        });
        if (!error && data?.length) { files = data; root = r; break; }
      }
      if (!files.length) return 0;

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
        const folderPath = root ? `${root}/${folder.name}` : folder.name;
        const { data: photos } = await supabase.storage.from(BUCKET).list(folderPath);
        if (!photos) continue;
        for (const file of photos) {
          const type = file.name.replace(/\.[^.]+$/, '');
          const id = `${folder.name}_${type}`;
          if (existing.has(id)) continue;

          const { data: blob } = await supabase.storage.from(BUCKET).download(`${folderPath}/${file.name}`);
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
