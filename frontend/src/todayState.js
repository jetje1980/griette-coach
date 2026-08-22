// Wat Vandaag toont: één toestand, één actie, en die twee vertellen hetzelfde.
//
// Dit is geen nieuwe engine. Er wordt hier niets berekend over hartslag,
// belasting, herstel of doelen — dat doen headCoach, restDayDecision,
// recoveryBudget, raceplan, hrModel, easyPace, strengthGate en Goal
// Intelligence al, en die blijven de bron. Dit bestand doet één ding: hun
// uitkomst vertalen naar wat er op het scherm moet staan.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAT
//
// De audit vond een tegenspraak: de statusregel zei "GROEN — kracht is
// vrijgegeven" terwijl de actie eronder was "beantwoord eerst je
// herstelcheck". Allebei waar in hun eigen laag — de poort staat inderdaad
// open voor kracht, en de respons ontbreekt inderdaad — maar samen op één
// scherm is het onleesbaar. Je leest de kleur, niet de kleine letters.
//
// De oplossing is niet meer uitleg maar minder ruimte: de status wordt
// afgeleid uit dezelfde bron als de actie, zodat ze niet uit elkaar kúnnen
// lopen. Vandaar de vijfde toestand.
//
//   WACHTEN  er ontbreekt iets wat ik nodig heb voordat ik iets durf te
//            zeggen. Geen kleuroordeel, want dat oordeel kan ik nog niet
//            geven. Dit is eerlijker dan groen tonen en dan om data vragen.
// ─────────────────────────────────────────────────────────────────

// Staat de herstelcheck nog open?
//
// Bewust dezelfde voorwaarde als het vragenblok in RecoveryCheck: getraind
// gisteren, en de hoofdpijnscore nog niet ingevuld. De rustdagpoort hanteert
// een ruimere lat — daar telt elk ingevuld veld in het venster mee — en dat is
// voor die vraag ook goed: "mag er belasting bij" is iets anders dan "ben ik
// nog iets aan het vragen".
//
// Maar op het scherm mogen die twee niet uit elkaar lopen. Als de app zichtbaar
// een vraag stelt, kan de status er niet "groen, ga lopen" boven zetten. Eén
// vraag tegelijk.
export function recoveryCheckOpen({ log = {}, logs = {}, currentDate } = {}) {
  if (!currentDate) return false;
  const gisteren = shiftDate(currentDate, -1);
  const gl = logs?.[gisteren];
  const getraindGisteren = !!(gl?.run_done || gl?.strength_done || gl?.core_done);
  if (!getraindGisteren) return false;
  return log?.headache_severity == null;
}

function shiftDate(d, n) {
  const x = new Date(d + 'T12:00:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

export const UI_STATE = {
  GREEN: 'GREEN',
  AMBER: 'AMBER',
  WAITING: 'WAITING',
  BLUE: 'BLUE',
  RED: 'RED',
};

export const STATE_META = {
  GREEN:   { word: 'Groen',   cls: 'v-green', emoji: '🟢' },
  AMBER:   { word: 'Amber',   cls: '',        emoji: '🟡' },
  WAITING: { word: 'Wachten', cls: 'v-wait',  emoji: '⏳' },
  BLUE:    { word: 'Blauw',   cls: 'v-blue',  emoji: '🔵' },
  RED:     { word: 'Rood',    cls: 'v-red',   emoji: '🔴' },
};

// Waar een knop naartoe gaat. De index komt uit TABS in App.jsx.
export const TAB = { VANDAAG: 0, WEEK: 1, LICHAAM: 2, LEVEN: 3, PROGRESSIE: 4, COACH: 5 };

// ── De afleiding ────────────────────────────────────────────────
// Volgorde is betekenis: wat eerder staat wint. Medisch boven wachten, wachten
// boven training, training boven de rest.
export function todayState({
  result, hasData, isFuture = false, log = {}, logs = {}, currentDate = null,
} = {}) {
  if (isFuture) {
    return {
      state: UI_STATE.BLUE,
      headline: 'Toekomstige dag',
      sub: 'Nog geen advies — dat maak ik op de dag zelf.',
      cta: null, secondary: null, missing: null, preview: null,
    };
  }

  // Zonder ochtendcheck is er geen advies. Dat is geen groene dag met een
  // opmerking eronder; het is wachten, en de knop is de check-in.
  if (!hasData || !result) {
    return {
      state: UI_STATE.WAITING,
      headline: 'Ik weet nog niet hoe je erbij zit',
      sub: 'Vul je ochtendcheck in — dan bereken ik je advies.',
      cta: { text: 'Vul je check-in in', kind: 'checkin' },
      secondary: null,
      missing: { what: 'ochtendcheck', why: 'zonder slaap, energie en herstelgevoel is elk advies een gok' },
      preview: null,
    };
  }

  const { status, action } = result;
  const bron = action?.source || null;
  const gate = result.detail?.runGate || null;
  const trained = !!result.detail?.trained;

  // 1. Medisch. Geen prestatieve knop, in geen enkele vorm.
  if (bron === 'medical' || status.decision === 'RED') {
    return {
      state: UI_STATE.RED,
      headline: action.headline,
      sub: action.detail,
      cta: null,
      secondary: { text: 'Bekijk waarom', kind: 'why' },
      missing: null,
      preview: null,
    };
  }

  // 2. Wachten op de 24–48u-respons. De status zegt dat ook, en niet "groen".
  if (bron === 'response' || gate?.action === 'WAIT_FOR_RESPONSE' ||
    recoveryCheckOpen({ log, logs, currentDate })) {
    return {
      state: UI_STATE.WAITING,
      headline: 'Eerst je herstelcheck',
      sub: 'Hoe reageerde je lichaam op de vorige training? Daarna geef ik de volgende sessie vrij.',
      cta: { text: 'Beantwoord je herstelcheck', kind: 'recovery' },
      secondary: null,
      missing: { what: 'herstelcheck', why: 'het 24–48u-venster is de meetlat, niet je ochtendgevoel' },
      preview: null,
    };
  }

  // 3. Al getraind, of een dag die om rust vraagt zonder rode vlag.
  if (trained || bron === 'protect' || status.decision === 'BLUE') {
    return {
      state: UI_STATE.BLUE,
      headline: action.headline,
      sub: action.detail,
      cta: null,
      secondary: { text: 'Bekijk waarom', kind: 'why' },
      missing: null,
      preview: null,
    };
  }

  // 4. Training. Vandaag is de vitrine, Lichaam is de werkplaats.
  if (bron === 'run' || bron === 'strength') {
    const kleur = status.decision === 'AMBER' ? UI_STATE.AMBER : UI_STATE.GREEN;
    return {
      state: kleur,
      // De statusregel is de betekenis, niet de sessie. "Lopen is vrijgegeven"
      // lees je in een halve seconde; de hele sessiebeschrijving in hoofdletters
      // stond er twee keer en las als een kop van vier regels.
      headline: status.sub || (bron === 'run' ? 'Lopen is vrijgegeven' : 'Kracht is vrijgegeven'),
      sub: null,
      cta: {
        text: bron === 'run' ? 'Bekijk / start training' : 'Bekijk / start krachttraining',
        kind: 'training', tab: TAB.LICHAAM,
      },
      secondary: null,
      missing: null,
      preview: previewFor(result, bron),
    };
  }

  // 5. Al het andere: een hefboomactie of een hersteldag zonder training.
  return {
    state: status.decision === 'AMBER' ? UI_STATE.AMBER : UI_STATE.GREEN,
    headline: action.headline,
    sub: action.detail,
    cta: { text: 'Gedaan', kind: 'mark' },
    secondary: null,
    missing: null,
    preview: null,
  };
}

// ── De preview ──────────────────────────────────────────────────
// Vier regels, meer niet: type, duur, structuur, tempo. Alles wat je tijdens
// het lopen nodig hebt — hartslagband, wandeltempo, wat de sessie moet
// bewijzen — staat op Lichaam, en dat is één tik verderop. Het hier ook tonen
// maakte Vandaag een tweede uitvoerscherm met net iets andere getallen.
function previewFor(result, bron) {
  const ns = result.detail?.nextSession;
  if (bron === 'run' && ns?.run) {
    return {
      kind: 'run',
      type: ns.purposeLabel || 'Loopsessie',
      duration: ns.run.duration != null ? `${ns.run.duration} min` : null,
      structure: ns.run.description || null,
      pace: ns.targetPace ? `Looptempo ±${paceLabel(ns.targetPace)}/km` : null,
    };
  }
  const st = result.detail?.strength;
  const c = st?.recommendedClass;
  if (bron === 'strength' && c) {
    return {
      kind: 'strength',
      type: c.title || 'Krachttraining',
      duration: c.duration != null ? `${c.duration} min` : null,
      structure: c.form ? c.form.toUpperCase() : null,
      pace: st.targetBand ? `${st.targetBand.replace(/_/g, ' ')} band` : null,
    };
  }
  return null;
}

// Tempo's reizen door de app als minuten per km. Hier alleen leesbaar maken.
function paceLabel(pace) {
  if (pace == null) return null;
  if (typeof pace === 'string' && pace.includes(':')) return pace;
  const min = Number(pace);
  if (!isFinite(min)) return null;
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Wat er nog echt nodig is ────────────────────────────────────
// Bewust smal. Niet elk leeg veld is een gemis; alleen wat het advies van
// vandaag blokkeert of onbetrouwbaar maakt telt. Alles daarbuiten hoort in de
// check-in-la en niet als waarschuwing op je eerste scherm.
export function whatIsMissing({ result, hasData, state } = {}) {
  if (state === UI_STATE.WAITING) {
    return hasData
      ? { what: 'Herstelcheck van je vorige training', kind: 'recovery' }
      : { what: 'Je ochtendcheck', kind: 'checkin' };
  }
  return null;
}
