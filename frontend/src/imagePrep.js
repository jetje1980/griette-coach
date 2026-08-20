// Eén plek waar een gekozen bestand een opslaanbare foto wordt.
//
// Waarom dit bestaat: er waren drie routes naar binnen — de camera bij
// progressiefoto's, een screenshot bij een workout, een beeld bij een droom —
// en elke route deed het nét anders. De progressiefoto ging zelfs helemaal
// ongecomprimeerd naar binnen: een telefoonfoto van 6 MB, base64 opgeslagen,
// dus 8 MB in IndexedDB én 8 MB naar de cloud. En allemaal zonder EXIF-
// correctie, waardoor een staande foto liggend terugkwam.
//
// Nu loopt alles hier langs. Camera en galerij zijn hetzelfde pad: het
// verschil zit alleen in welk bestand de browser aanlevert.
//
// Twee dingen die het bestand doet die niet vanzelf gaan:
//
//   ORIËNTATIE  een telefoon draait de sensor niet mee; hij schrijft in de
//               EXIF-kop hoe je het beeld moet draaien. Canvas negeert dat.
//               Zonder correctie staat elke staande foto op zijn kant.
//   FORMAAT     1600 px op de langste zijde is ruim genoeg om houding en
//               vorm te vergelijken, en scheelt een factor tien in opslag.

// Standaard voor progressiefoto's en screenshots.
export const MAX_DIM = 1600;
export const QUALITY = 0.85;

// ── EXIF-oriëntatie uitlezen ────────────────────────────────────
// Alleen JPEG heeft dit. We zoeken het APP1-blok (Exif) en daarin tag 0x0112.
// Levert 1..8, of 1 als er niets te vinden is.
export function readExifOrientation(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1;  // geen JPEG

    let offset = 2;
    while (offset < view.byteLength - 1) {
      if (view.getUint8(offset) !== 0xff) return 1;                 // geen geldige marker
      const marker = view.getUint8(offset + 1);
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2; continue;                                      // markers zonder lengte
      }
      if (marker === 0xda) return 1;                                // beeldgegevens beginnen
      const size = view.getUint16(offset + 2, false);
      if (size < 2) return 1;

      if (marker === 0xe1) {                                        // APP1
        const exifStart = offset + 4;
        if (view.getUint32(exifStart, false) !== 0x45786966) {       // "Exif"
          offset += 2 + size; continue;
        }
        const tiff = exifStart + 6;                                 // na "Exif\0\0"
        const little = view.getUint16(tiff, false) === 0x4949;
        if (view.getUint16(tiff + 2, little) !== 0x002a) return 1;
        const ifd0 = tiff + view.getUint32(tiff + 4, little);
        const count = view.getUint16(ifd0, little);
        for (let i = 0; i < count; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (view.getUint16(entry, little) === 0x0112) {
            const v = view.getUint16(entry + 8, little);
            return v >= 1 && v <= 8 ? v : 1;
          }
        }
        return 1;
      }
      offset += 2 + size;
    }
  } catch {
    // Een onleesbare kop is geen reden om de foto te weigeren.
  }
  return 1;
}

// Bij oriëntatie 5..8 wisselen breedte en hoogte om.
export function orientationSwapsAxes(o) {
  return o >= 5 && o <= 8;
}

// De transformatie die de canvas-context nodig heeft om het beeld
// rechtop te zetten. w/h zijn de afmetingen ná de eventuele wissel.
export function orientationTransform(ctx, o, w, h) {
  switch (o) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;                // gespiegeld
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;               // 180°
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;                // verticaal gespiegeld
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, w, 0); break;                // 90° met de klok mee
    case 7: ctx.transform(0, -1, -1, 0, w, h); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, h); break;                // 90° tegen de klok in
    default: break;                                                  // 1: niets te doen
  }
}

// ── Doet de browser het al zelf? ────────────────────────────────
// Sinds een jaar of vijf draaien browsers een JPEG uit zichzelf goed:
// `image-orientation: from-image` is de standaardwaarde. Dan is naturalWidth
// al de gedraaide breedte, en tekent drawImage het beeld al rechtop.
//
// Wie dan alsnog zijn eigen draaiing toepast, draait twee keer — en dat is
// erger dan niets doen. Maar het omgekeerde aannemen kan ook niet: een oudere
// webview doet het níet, en dan ligt elke staande foto op zijn kant.
//
// Dus meten. Eén keer per sessie: een piepklein beeld van 2 × 1 met
// oriëntatie 6 erin. Komt het terug als 1 × 2, dan draait de browser zelf.
let _autoOrients = null;

function exifApp1(orientation) {
  const b = [];
  const p16 = v => b.push(v & 0xff, (v >> 8) & 0xff);
  const p32 = v => b.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  b.push(0x45, 0x78, 0x69, 0x66, 0x00, 0x00);       // "Exif\0\0"
  b.push(0x49, 0x49); p16(0x002a); p32(8);           // TIFF, little-endian
  p16(1); p16(0x0112); p16(3); p32(1); p16(orientation); p16(0); p32(0);
  const len = b.length + 2;
  return [0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...b];
}

export async function browserAutoOrients() {
  if (_autoOrients !== null) return _autoOrients;
  try {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 1;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 2, 1);
    const raw = atob(c.toDataURL('image/jpeg').split(',')[1]);
    const src = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) src[i] = raw.charCodeAt(i);

    const app1 = exifApp1(6);
    const probe = new Uint8Array(2 + app1.length + src.length - 2);
    probe.set(src.slice(0, 2), 0);                   // SOI
    probe.set(app1, 2);
    probe.set(src.slice(2), 2 + app1.length);

    const img = await loadImage(new Blob([probe], { type: 'image/jpeg' }));
    _autoOrients = img.naturalWidth === 1 && img.naturalHeight === 2;
  } catch {
    _autoOrients = false;                            // bij twijfel: zelf draaien
  }
  return _autoOrients;
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('bestand onleesbaar'));
    r.readAsArrayBuffer(file);
  });
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('geen leesbare afbeelding')); };
    img.src = url;
  });
}

// ── Het enige dat de rest van de app aanroept ───────────────────
// file → { base64, mimeType, width, height, bytes, orientation, source }
//
// `source` is puur beschrijvend ('camera' of 'galerij') en gaat mee als
// metadata; het verandert niets aan de bewerking. Camera en galerij moeten
// exact hetzelfde resultaat opleveren.
export async function prepareImage(file, opts = {}) {
  const max = opts.max ?? MAX_DIM;
  const quality = opts.quality ?? QUALITY;
  const source = opts.source || null;

  if (!file) throw new Error('geen bestand');
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Dit is geen afbeelding.');
  }

  const buffer = await readAsArrayBuffer(file);
  const orientation = readExifOrientation(buffer);
  const auto = await browserAutoOrients();
  // Draait de browser al, dan is er niets meer te draaien: het beeld dat we
  // in handen krijgen staat al goed. `orientation` blijft wel bewaard als
  // beschrijving van wat er in het bestand stond.
  const apply = auto ? 1 : orientation;

  const img = await loadImage(new Blob([buffer], { type: file.type || 'image/jpeg' }));

  const swap = orientationSwapsAxes(apply);
  const srcW = swap ? img.naturalHeight : img.naturalWidth;
  const srcH = swap ? img.naturalWidth : img.naturalHeight;
  if (!srcW || !srcH) throw new Error('afbeelding heeft geen afmetingen');

  let width = srcW, height = srcH;
  if (width > max || height > max) {
    const scale = max / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  orientationTransform(ctx, apply, width, height);
  // Ná de transformatie tekenen we in het assenstelsel van het ruwe beeld:
  // bij een gewisselde as is dat hoogte × breedte.
  if (swap) ctx.drawImage(img, 0, 0, height, width);
  else ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1];

  return {
    base64,
    mimeType: 'image/jpeg',
    width, height,
    orientation,                 // wat er in het bestand stond
    autoOriented: auto,          // en of de browser dat zelf al had rechtgezet
    source,
    bytes: Math.round(base64.length * 0.75),
    originalBytes: file.size ?? null,
    originalType: file.type || null,
  };
}
