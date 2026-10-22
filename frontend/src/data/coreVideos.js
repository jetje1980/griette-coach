// Videolinks bij kracht — gevonden, niet geverifieerd, en door haar te beheren.
//
// ─────────────────────────────────────────────────────────────────
// WAT HIER STAAT EN WAT NIET
//
// Zij vroeg om Victoria's Secret abs-workouts van YouTube bij het
// krachtonderdeel. De links hieronder komen uit een zoekopdracht. Twee
// dingen daarover, eerlijk:
//
//   1. Ze zijn NIET geverifieerd. Vanuit de omgeving waarin deze app wordt
//      gebouwd is youtube.com niet bereikbaar (netwerkbeleid), dus ik heb
//      niet kunnen controleren of een video nog bestaat, van welk kanaal
//      hij is of hoe lang hij duurt. Wat er staat is de titel zoals de
//      zoekmachine hem teruggaf.
//   2. YouTube-links verrotten. Kanalen gooien video's offline, zetten ze
//      op privé of verplaatsen ze. Een lijst die alleen in de code staat,
//      is over een half jaar half stuk en dan moet er iemand aan de code
//      komen om een linkje te vervangen.
//
// Daarom is dit een startlijst en geen vaste inhoud: wat zij in de app
// toevoegt of verwijdert staat in haar eigen opslag en gaat vóór deze
// lijst. Zie coreVideoStore.js.
//
// ─────────────────────────────────────────────────────────────────
// ÉÉN COACHOPMERKING, ÉÉN KEER
//
// Deze video's heten "flat stomach" en "11 line abs". Wat ze werkelijk
// doen is je buikspieren belasten, en dat is nuttig — het hoort bij haar
// doel van een sterkere romp. Wat ze niet doen is vet weghalen op de plek
// waar je de oefening voelt; dat werkt bij niemand zo. Hoe vlak een buik
// oogt, hangt af van wat eroverheen zit en van hoe je ribben en bekken
// staan — en dat tweede is precies waar de core-oefeningen in dit
// programma op mikken (hollow hold, Pallof press, dead bug).
//
// Dus: doe ze als je ze leuk vindt, ze zijn een goede aanvulling. Alleen
// niet in plaats van de eigen core-blokken, en niet in de verwachting dat
// de video het werk doet dat je voeding en je houding doen.
// ─────────────────────────────────────────────────────────────────

export const VIDEO_SOURCE_NOTE =
  'Deze links komen uit een zoekopdracht en zijn niet nagekeken — '
  + 'YouTube was niet bereikbaar vanuit de bouwomgeving. Werkt er een niet, '
  + 'verwijder hem dan en zet je eigen link ervoor.';

// `minutes` is wat de titel belooft, niet wat ik heb gemeten.
export const CORE_VIDEOS = [
  {
    id: 'vs_6min',
    title: "6 min Victoria's Secret abs",
    url: 'https://www.youtube.com/watch?v=EmfNKttx1n0',
    minutes: 6,
    note: 'Kort. Past als toevoeging na een looptraining of op een rustdag.',
    tags: ['kort', 'geen materiaal'],
  },
  {
    id: 'vs_20min_abs_booty',
    title: "20 min Victoria's Secret abs & booty — zonder materiaal",
    url: 'https://www.youtube.com/watch?v=u8v6RvMS9QI',
    minutes: 20,
    note: 'Romp en bilspieren samen. Dat tweede helpt je hardlopen direct.',
    tags: ['20 min', 'geen materiaal'],
  },
  {
    id: 'vs_trainer',
    title: "Booty, thigh & abs — trainer van Victoria's Secret-modellen",
    url: 'https://www.youtube.com/watch?v=Qy-XWqFagV0',
    minutes: null,
    note: 'Van een trainer die met de modellen werkt, geen fan-compilatie.',
    tags: ['geen materiaal'],
  },
  {
    id: 'vs_tabata_abby',
    title: 'Tabata abs met Abby Champion (+ cardio)',
    url: 'https://www.youtube.com/watch?v=K097NYZ-E0c',
    minutes: null,
    note: 'Tabata is intervalwerk: dit tilt je hartslag op. Op een dag waarop '
      + 'je loopplafond geldt, de cardiobonus overslaan.',
    tags: ['intensief'],
  },
  {
    id: 'vs_fullbody',
    title: "Victoria's Secret full body workout",
    url: 'https://www.youtube.com/watch?v=PKsrSIsFsGk',
    minutes: 20,
    note: 'Hele lichaam. Prima als vervanging van een krachtsessie, niet als extra.',
    tags: ['20 min'],
  },
  {
    id: 'vs_realtime_cristina',
    title: 'Abs & inner thighs met Cristina — real time',
    url: 'https://www.youtube.com/watch?v=idH8jz80cUI',
    minutes: null,
    note: 'Meeloopvideo op echte snelheid, dus zonder pauzeren.',
    tags: ['meeloop'],
  },
];

// Welke video's passen bij hoeveel tijd je hebt? Zonder opgegeven duur
// komt hij altijd mee: onbekend is geen uitsluiting.
export function videosForMinutes(minuten, lijst = CORE_VIDEOS) {
  if (!minuten) return lijst;
  return lijst.filter(v => v.minutes == null || v.minutes <= minuten);
}
