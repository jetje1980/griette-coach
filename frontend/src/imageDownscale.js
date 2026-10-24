// Een foto verkleinen vóór het opslaan.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ER MOET ZIJN
//
// Haar eerste challengefoto is 2,65 MB. Haar wekelijkse progressiefoto's
// zijn ongeveer 260 kB — tien keer kleiner, en net zo bruikbaar om naar te
// kijken. Het verschil is dat de progressiefoto's door de camera-app zijn
// verkleind en de challengefoto rechtstreeks uit de galerij op volle
// resolutie werd doorgegeven.
//
// Over 75 dagen is dat ongeveer 200 MB. Dat is een probleem op drie
// plekken tegelijk:
//
//   · IndexedDB heeft een quotum. Loopt dat vol, dan mislukt het opslaan —
//     en dan is de foto van die dag weg terwijl zij denkt dat hij bewaard is;
//   · elke foto gaat ook naar de cloud, dus 200 MB opslag en 200 MB upload
//     over een mobiele verbinding;
//   · de feed laadt de beelden als base64 in het geheugen. Twintig foto's
//     van 2,65 MB tegelijk laat een telefoon struikelen.
//
// Een progressiefoto hoeft niet scherper te zijn dan waar je hem voor
// gebruikt: naast elkaar zetten en kijken of je omtrek verandert. 1280
// pixels op de lange zijde is daarvoor ruim.
//
// Wat deze functie NIET doet: iets wegwerken zonder het te zeggen. De
// uitkomst meldt wat er gebeurde, zodat het scherm dat kan tonen.
// ─────────────────────────────────────────────────────────────────

export const MAX_SIDE = 1280;
export const QUALITY = 0.82;

// Boven deze grootte wordt er verkleind. Daaronder niet: opnieuw
// comprimeren van een al kleine foto levert verlies zonder winst.
export const SIZE_THRESHOLD_BYTES = 600 * 1024;

const kb = (n) => Math.round(n / 1024);

// `file` is een File of Blob. Terug komt { base64, mimeType, note, ... }.
export async function downscaleForStorage(file, { maxSide = MAX_SIDE,
  quality = QUALITY, threshold = SIZE_THRESHOLD_BYTES } = {}) {
  const origineel = await naarBase64(file);

  // Klein genoeg, of geen canvas beschikbaar: ongewijzigd doorgeven. Een
  // foto niet kunnen verkleinen is geen reden om hem niet te bewaren.
  if (file.size <= threshold || typeof document === 'undefined') {
    return { base64: origineel, mimeType: file.type || 'image/jpeg',
      resized: false, originalBytes: file.size, bytes: file.size, note: null };
  }

  try {
    const bitmap = await laadAfbeelding(origineel, file.type);
    // `origineel` wordt meegegeven aan klaar(), zodat die kan terugvallen
    // als het resultaat groter uitpakt dan de bron.
    const factor = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (factor >= 1) {
      // Al binnen de maat maar toch zwaar: alleen hercomprimeren.
      const uit = await naarJpeg(bitmap, bitmap.width, bitmap.height, quality);
      return klaar(uit, file, bitmap, bitmap.width, bitmap.height, origineel);
    }
    const b = Math.round(bitmap.width * factor);
    const h = Math.round(bitmap.height * factor);
    const uit = await naarJpeg(bitmap, b, h, quality);
    return klaar(uit, file, bitmap, b, h, origineel);
  } catch {
    // Mislukt het verkleinen, dan gaat het origineel erin. Liever een grote
    // foto dan geen foto.
    return { base64: origineel, mimeType: file.type || 'image/jpeg',
      resized: false, originalBytes: file.size, bytes: file.size,
      note: 'Verkleinen lukte niet; de foto is op volle grootte bewaard.' };
  }
}

function klaar(uit, file, bitmap, b, h, origineel) {
  const bytes = Math.round(uit.base64.length * 3 / 4);
  // Groter geworden? Dan het origineel houden. Dat kan gebeuren bij een
  // afbeelding die al sterker gecomprimeerd was dan onze kwaliteit.
  if (bytes >= file.size) {
    return { base64: origineel, mimeType: file.type || 'image/jpeg',
      resized: false, originalBytes: file.size, bytes: file.size, note: null };
  }
  return {
    base64: uit.base64, mimeType: 'image/jpeg', resized: true,
    width: b, height: h,
    originalWidth: bitmap.width, originalHeight: bitmap.height,
    originalBytes: file.size, bytes,
    note: `Verkleind van ${kb(file.size)} kB naar ${kb(bytes)} kB `
      + `(${bitmap.width}×${bitmap.height} → ${b}×${h}).`,
  };
}

function naarBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error || new Error('lezen mislukt'));
    r.readAsDataURL(file);
  });
}

function laadAfbeelding(base64, mime) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('afbeelding niet te lezen'));
    img.src = `data:${mime || 'image/jpeg'};base64,${base64}`;
  });
}

async function naarJpeg(img, b, h, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = b; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, b, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.split(',')[1] };
}
