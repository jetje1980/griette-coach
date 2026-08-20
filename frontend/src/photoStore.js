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

// ── Het pad ─────────────────────────────────────────────────────
//
//   {user_id}/progress/{datum}/{type}/{id}.{ext}
//
// Vier dingen, elk met een reden:
//
//   user_id   het opslagbeleid schrijft eigenaar-alleen voor; met het id
//             vooraan is dat ook aan het pad te zien;
//   progress  deze bucket herbergt ook workout-screenshots en droombeelden.
//             Zonder dit segment lopen die door elkaar;
//   datum     één fotomoment is één map;
//   type      voor, zij, achter — een eigen map, geen bestandsnaam. Zo kan er
//             later een tweede opname bij zonder de eerste te overschrijven;
//   id        het beslissende verschil met het oude pad. Daar heette het
//             bestand `voor.jpeg`, en een tweede foto van hetzelfde moment
//             overschreef de eerste stilzwijgend.
//
// Twee oudere indelingen blijven leesbaar zolang er nog bestanden op staan:
//   {user_id}/progress/{datum}/{type}.{ext}   (vorige versie)
//   {datum}/{type}.{ext}                      (de allereerste)
export async function userPrefix() {
  const uid = await getUserId();
  return uid ? `${uid}/progress` : null;
}

const PHOTO_TYPES = ['voor', 'zij', 'achter'];

function newPhotoId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function photoPath({ prefix, date, type, id, ext }) {
  return `${prefix}/${date}/${type}/${id}.${ext}`;
}

// Het nieuwe pad herken je aan de aanzichtmap: .../{datum}/{type}/{id}.{ext}
const NEW_LAYOUT = new RegExp(
  `/\\d{4}-\\d{2}-\\d{2}/(?:${PHOTO_TYPES.join('|')})/[^/]+\\.[A-Za-z0-9]+$`);

export function isNewLayout(path) {
  return !!path && NEW_LAYOUT.test(path);
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
async function uploadToCloud(date, type, base64, mimeType, photoId = null) {
  const prefix = await userPrefix();
  if (!prefix) {
    return { ok: false, skipped: true, reason: 'niet ingelogd' };
  }
  const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const id = photoId || newPhotoId();
  const path = photoPath({ prefix, date, type, id, ext });
  mediaUploadStart();
  try {
    const blob = b64toBlob(base64, mimeType);
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: mimeType,
    });
    if (error) throw error;
    // Teruglezen: een upload zonder readback is geen bewijs.
    const { data: check, error: readErr } = await supabase.storage.from(BUCKET)
      .list(`${prefix}/${date}/${type}`, { search: `${id}.${ext}` });
    if (readErr) throw readErr;
    if (!check?.length) throw new Error('bestand niet terug te vinden na uploaden');
    mediaUploadDone(path, null);
    return { ok: true, path, photoId: id };
  } catch (e) {
    const reason = e?.message || String(e);
    mediaUploadDone(path, reason, `foto ${type} van ${date}`);
    return { ok: false, path, reason };
  }
}

// Verwijderen moet alle drie de indelingen raken, anders blijft er een kopie
// achter die bij de volgende herstelactie gewoon weer terugkomt.
async function deleteFromCloud(date, type) {
  try {
    const prefix = await userPrefix();
    const exts = ['jpg', 'jpeg', 'png', 'webp'];
    const paths = [];

    if (prefix) {
      // Nieuw: alles in {prefix}/{datum}/{type}/ — het aantal bestanden staat
      // niet vast, dus eerst opvragen.
      const { data } = await supabase.storage.from(BUCKET).list(`${prefix}/${date}/${type}`);
      for (const f of data || []) if (f.id) paths.push(`${prefix}/${date}/${type}/${f.name}`);
      // Vorige indeling.
      for (const e of exts) paths.push(`${prefix}/${date}/${type}.${e}`);
    }
    // Allereerste indeling, in de bucketroot.
    for (const e of exts) paths.push(`${date}/${type}.${e}`);

    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
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
    // De sleutel in IndexedDB blijft {datum}_{type}: per fotomoment één beeld
    // per aanzicht, dat is wat het scherm toont. photoId is de identiteit van
    // het bestand in de cloud, en die is een ander ding.
    const photoId = meta.photoId || newPhotoId();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        id: `${date}_${type}`,
        photoId,
        date, type, base64, mimeType,
        savedAt: new Date().toISOString(),
        ...meta,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    // Eerst lokaal (dan is hij nooit kwijt), daarna naar de cloud — en op
    // die cloud wachten we wél, zodat het scherm de waarheid kan tonen.
    const res = await uploadToCloud(date, type, base64, mimeType, photoId);
    if (res.ok) {
      const db2 = await openDB();
      await new Promise(done => {
        const tx = db2.transaction(STORE, 'readwrite');
        const st = tx.objectStore(STORE);
        const req = st.get(`${date}_${type}`);
        req.onsuccess = () => {
          if (req.result) st.put({ ...req.result, cloudOk: true, cloudPath: res.path,
            photoId: res.photoId || req.result.photoId });
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
      const r = await uploadToCloud(p.date, p.type, p.base64, p.mimeType || 'image/jpeg', p.photoId);
      if (r.ok) {
        uploaded++;
        await new Promise(res => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({ ...p, cloudOk: true, cloudPath: r.path,
            photoId: r.photoId || p.photoId });
          tx.oncomplete = res; tx.onerror = res;
        });
      } else if (!r.skipped) failed++;
    }
    return { uploaded, failed };
  },

  // Foto's op een oude padindeling overzetten naar de nieuwe.
  //
  // Niet-destructief: het oude bestand blijft staan. Wat hier gebeurt is een
  // kopie op het nieuwe pad, en pas als die aantoonbaar gelukt is verhuist de
  // verwijzing mee. Wie het oude bestand meteen zou weghalen, wist een foto
  // op grond van een upload die misschien niet is aangekomen.
  async migratePaths() {
    const prefix = await userPrefix();
    if (!prefix) return { migrated: 0, skipped: true };
    const db = await openDB();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error);
    });

    let migrated = 0, failed = 0;
    for (const p of all) {
      if (isNewLayout(p.cloudPath)) continue;
      if (!p.base64) continue;
      const r = await uploadToCloud(p.date, p.type, p.base64, p.mimeType || 'image/jpeg',
        p.photoId || null);
      if (!r.ok) { if (!r.skipped) failed++; continue; }
      await new Promise(done => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ ...p, cloudOk: true, cloudPath: r.path,
          photoId: r.photoId, legacyPath: p.cloudPath || null });
        tx.oncomplete = done; tx.onerror = done;
      });
      migrated++;
    }
    return { migrated, failed };
  },

  // Restore photos from cloud that are missing in IndexedDB
  async restoreFromCloud() {
    try {
      const prefix = await userPrefix();
      if (!prefix) return 0;               // niet ingelogd: niets ophalen

      // Beide locaties, allebei helemaal.
      //
      // Hier zat een fout die pas zichtbaar werd toen ik in de echte opslag
      // keek: de lus stopte bij het eerste pad dat iets opleverde. Omdat er
      // onder {user_id}/progress altijd wel iets staat, werd de bucketroot
      // nooit meer bekeken — en daar staan haar eerste series nog, van 6 en
      // 25 juni, uit de tijd dat de paden nog geen gebruikers-id hadden.
      // Zes foto's die na een wipe niet terug zouden komen.
      const folders = [];
      for (const root of [prefix, '']) {
        const { data, error } = await supabase.storage.from(BUCKET).list(root, {
          limit: 500, sortBy: { column: 'name', order: 'desc' },
        });
        if (error || !data?.length) continue;
        for (const entry of data) {
          // Alleen datummappen (id === null); losse bestanden overslaan.
          if (entry.id) continue;
          // In de bucketroot staan ook de mappen van de ingelogde gebruiker
          // zelf; die zijn via het volledige pad al gezien.
          if (!root && !/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
          folders.push({ root, name: entry.name });
        }
      }
      if (!folders.length) return 0;

      const db = await openDB();
      const existing = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAllKeys();
        req.onsuccess = () => resolve(new Set(req.result));
        req.onerror = () => reject(req.error);
      });

      let restored = 0;
      for (const folder of folders) {
        const folderPath = folder.root ? `${folder.root}/${folder.name}` : folder.name;
        const { data: entries } = await supabase.storage.from(BUCKET).list(folderPath);
        if (!entries) continue;

        // Binnen een datummap staat óf een bestand per aanzicht (de oude
        // indelingen), óf een map per aanzicht met daarin de bestanden (de
        // nieuwe). Beide kunnen naast elkaar bestaan zolang niet alles is
        // overgezet, dus we lopen ze allebei af.
        const targets = [];
        for (const entry of entries) {
          if (entry.id) {
            // Bestand direct in de datummap: {type}.{ext}
            targets.push({
              type: entry.name.replace(/\.[^.]+$/, ''),
              path: `${folderPath}/${entry.name}`,
              photoId: null,
            });
          } else if (PHOTO_TYPES.includes(entry.name)) {
            // Map per aanzicht: {type}/{id}.{ext}. Bij meerdere bestanden
            // wint de nieuwste — het scherm toont er één per aanzicht.
            const { data: files } = await supabase.storage.from(BUCKET)
              .list(`${folderPath}/${entry.name}`, {
                limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
            const newest = (files || []).find(f => f.id);
            if (!newest) continue;
            targets.push({
              type: entry.name,
              path: `${folderPath}/${entry.name}/${newest.name}`,
              photoId: newest.name.replace(/\.[^.]+$/, ''),
            });
          }
        }

        for (const t of targets) {
          const key = `${folder.name}_${t.type}`;
          if (existing.has(key)) continue;

          const { data: blob } = await supabase.storage.from(BUCKET).download(t.path);
          if (!blob) continue;

          const base64 = await new Promise(res => {
            const reader = new FileReader();
            reader.onloadend = () => res(String(reader.result).split(',')[1]);
            reader.readAsDataURL(blob);
          });

          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({
              id: key,
              photoId: t.photoId,
              date: folder.name,
              type: t.type,
              base64,
              mimeType: blob.type || 'image/jpeg',
              savedAt: new Date().toISOString(),
              // Van deze foto is bewezen dat hij in de cloud staat: hij komt
              // er net vandaan. Zo probeert pushMissingToCloud hem niet
              // meteen weer omhoog te duwen.
              cloudOk: true,
              cloudPath: t.path,
            });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
          });
          existing.add(key);
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
