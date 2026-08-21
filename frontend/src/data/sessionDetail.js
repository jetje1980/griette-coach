// Volledige sessie-instructie per hardlooptraining, afgeleid uit RUNS + trainingsblok.
// Warming-up, kern, HR/RPE-doel, waarom, cooling-down, stop-criteria en
// "coach observeert vandaag" — zodat elke training ook een datapunt is.

import { RUNS, runDistance } from './runningSchema';
import { loadHrSettings } from '../goals';
import { easyHrLine } from '../hrModel';

function rpeTarget(run) {
  const hr = loadHrSettings();
  if (run.race) return `${hr.rpeThreshold - 1}–${hr.rpeThreshold}/10 (race — easy HR blijft de grens)`;
  if (run.restDay) return '1–2/10';
  if (run.duration <= 18) return `${Math.max(1, hr.rpeEasy - 2)}–${Math.max(2, hr.rpeEasy - 1)}/10`;
  return `${Math.max(2, hr.rpeEasy - 1)}–${hr.rpeEasy}/10`;
}

function coachObserves(run) {
  const prev = RUNS.find(r => r.nr === run.nr - 1);
  const obs = [];
  if (run.race) {
    obs.push('Kan de hele race binnen je easy HR-band worden uitgelopen?');
    obs.push('Waar zit de beperkende factor: hartslag, benen of algemene energie?');
  } else {
    obs.push('Blijft de hartslag stabiel binnen je easy HR-band tijdens de loopblokken?');
    if (prev && run.walkMin < prev.walkMin) obs.push(`Daalt de HR snel genoeg in de kortere wandelpauze (${run.walkMin} min)?`);
    else obs.push('Hoe snel daalt de HR in de wandelpauzes?');
    if (prev && run.runMin > prev.runMin) obs.push(`Verdraagt het lichaam de langere loopblokken (${run.runMin} min)?`);
    else obs.push('Voelt dezelfde belasting makkelijker dan de vorige keer (RPE)?');
  }
  obs.push('Hoe reageert het lichaam morgen en overmorgen (delayed response)?');
  return obs;
}

// `paces` komt uit easyPace.measuredPaces() — jouw eigen gemeten tempo's.
// Zonder die parameter verschijnt er geen afstand, en dat is met opzet: een
// afstand zonder tempo is een verzonnen getal.
export function sessionDetail(run, paces = null) {
  if (!run) return null;
  // Fase op basis van het week-nummer van het schema
  const blockName = run.week <= 2 ? 'REBUILD'
    : run.week <= 7 ? 'AEROBIC BASE'
    : run.week <= 11 ? 'ECONOMY'
    : 'CONTINUOUS RUNNING';

  const kern = run.reps
    ? `${run.reps} × ${run.runMin} min ${run.runMin > 0 ? 'rustig lopen' : ''}${run.walkMin ? ` / ${run.walkMin} min wandelen` : ''}`
    : run.description;

  return {
    nr: run.nr,
    block: blockName,
    title: run.description,
    type: run.race ? 'Race' : run.restDay ? 'Actief herstel' : 'Run/walk — aeroob',
    warmup: run.race
      ? '10 min rustig wandelen + 2× 1 min heel rustig indraven'
      : `5 min rustig wandelen (HR onder ${loadHrSettings().easyLow})`,
    core: kern,
    runWalk: run.runMin != null && run.walkMin != null
      ? `${run.runMin} min lopen / ${run.walkMin} min wandelen`
      : null,
    reps: run.reps,
    duration: run.duration,
    km: runDistance(run, paces)?.label || null,
    hrZone: easyHrLine(),
    // De hartslaginstructie hoort bij een sessiedoel, niet bij een regel in
    // de bibliotheek. Wat er vandaag mag komt uit hrModel; hier staat alleen
    // wat er van de vorm te zeggen valt.
    hrTip: null,
    rpe: rpeTarget(run),
    // Geen tempo uit de bibliotheek. Wordt `paces` meegegeven (uit
    // easyPace.measuredPaces), dan staat het tempo in `km` verwerkt.
    tempo: null,
    goal: run.goal,
    why: `Deze sessie hoort bij ${blockName}: ${
      blockName === 'REBUILD' ? 'weer wennen aan belasting zonder het herstel te overvragen.'
      : blockName === 'AEROBIC BASE' ? 'de aerobe basis vergroten — meer verdragen bij dezelfde lage hartslag.'
      : blockName === 'ECONOMY' ? 'loopeconomie — langere loopblokken met kortere pauzes bij gelijke belasting.'
      : 'de stap naar doorlopend hardlopen.'
    }`,
    cooldown: '5 min rustig wandelen + kort losmaken (kuiten, heupen)',
    stopCriteria: [
      `Blijft je hartslag structureel boven ${loadHrSettings().easyHigh} bpm → tempo omlaag; ` +
        `gaat hij richting ${loadHrSettings().easyHigh + 8} → wandelen tot onder ` +
        `${loadHrSettings().resumeBelow} bpm`,
      `RPE hoger dan ${loadHrSettings().rpeEasy + 1} → terug naar wandelen`,
      'Zware benen of duizeligheid → stoppen, dit is data, geen falen',
      'Herstelstatus is Amber → de lichtere variant kiezen',
      run.hrTip,
    ].filter(Boolean),
    observes: coachObserves(run),
    successNote: 'Succes is niet: sneller lopen. Succes is: dezelfde belasting gemakkelijker verdragen en 24–48 uur later goed hersteld zijn.',
  };
}
