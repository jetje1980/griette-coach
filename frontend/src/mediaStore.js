// Gedeelde mediaopslag: private Supabase Storage als bron, IndexedDB als cache.
// Gebruikt voor Dream Board-afbeeldingen en workout-screenshots, die eerder
// alleen lokaal stonden en dus verdwenen bij een cache-clear of ander toestel.
//
// Paden: {user_id}/{soort}/{id}.jpg — de bucket is privé en policies staan
// alleen de eigenaar toe.

import { supabase, getUserId } from './supabase';
import { mediaUploadStart, mediaUploadDone } from './sync';

const BUCKET = 'progress-photos';

function extFor(mimeType) {
  return (mimeType || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
}

export async function mediaPath(kind, id, mimeType) {
  const uid = await getUserId();
  if (!uid) return null;
  return `${uid}/${kind}/${id}.${extFor(mimeType)}`;
}

function b64toBlob(base64, mimeType) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

async function blobToB64(blob) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

// Upload + directe readback-verificatie. Geeft het pad terug als het
// bestand aantoonbaar in de cloud staat, anders null.
export async function uploadMedia(kind, id, base64, mimeType) {
  const path = await mediaPath(kind, id, mimeType);
  if (!path) return null;
  mediaUploadStart();
  try {
    const blob = b64toBlob(base64, mimeType);
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: mimeType });
    if (error) throw error;

    // Verificatie: pas als het bestand terugleesbaar is, geldt het als geland
    const { data: check, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
    if (dlErr || !check || check.size === 0) throw new Error('teruglezen mislukt');
    mediaUploadDone(path, null);
    return path;
  } catch (e) {
    // Ook hier: niet alleen naar de console. De centrale melding moet het weten.
    mediaUploadDone(path, e?.message || String(e), `${kind}/${id}`);
    return null;
  }
}

export async function downloadMedia(path) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return { base64: await blobToB64(data), mimeType: data.type || 'image/jpeg' };
  } catch { return null; }
}

export async function deleteMedia(path) {
  if (!path) return;
  try { await supabase.storage.from(BUCKET).remove([path]); }
  catch (e) { console.warn('Media verwijderen mislukt:', e.message); }
}

// Alle bestanden van één soort voor de ingelogde gebruiker
export async function listMedia(kind) {
  const uid = await getUserId();
  if (!uid) return [];
  try {
    const { data, error } = await supabase.storage.from(BUCKET)
      .list(`${uid}/${kind}`, { limit: 500 });
    if (error || !data) return [];
    return data
      .filter(f => f.id)
      .map(f => ({ name: f.name, path: `${uid}/${kind}/${f.name}`,
        id: f.name.replace(/\.[^.]+$/, '') }));
  } catch { return []; }
}
