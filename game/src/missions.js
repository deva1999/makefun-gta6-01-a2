// The story of Neon Tide, in five jobs for fixer Lucia "Lulu" Ferrer.
// Rafi, a broke boat mechanic, owes the wrong people money. Lulu offers
// work: wheels, a package, heat, cash, and one last neon-lit run to the
// marina before the tide — and the Policia — close in.

import { ECONOMY } from './config.js';

export const STORY_INTRO = [
  'Rafi owes the dock crew 5,000 pesos and has 120 to his name.',
  'Fixer Lulu Ferrer hires fast drivers who ask no questions.',
  'Five jobs. One tide. Do not get caught.',
];

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Job 1 · First Wheels',
    giver: 'Lulu Ferrer',
    brief: 'Get to Molo Garage and take the marked Brisa Coupe. Any wheels will do — press E beside a car.',
    objective: 'Reach Molo Garage and enter the marked car',
    pay: ECONOMY.missionPay[0],
    steps: [
      { kind: 'goto', x: 460, y: 860, radius: 90, label: 'Molo Garage' },
      { kind: 'enterMarkedCar', label: 'Enter the Brisa Coupe' },
    ],
  },
  {
    id: 'package-run',
    title: 'Job 2 · Package Run',
    giver: 'Lulu Ferrer',
    brief: 'A package waits at Old Market Square. Pick it up and drop it at Casa Segura before anyone asks what is inside.',
    objective: 'Pick up the package at Old Market Square',
    pay: ECONOMY.missionPay[1],
    steps: [
      { kind: 'goto', x: 1240, y: 440, radius: 70, label: 'Old Market Square — pick up the package' },
      { kind: 'goto', x: 860, y: 2060, radius: 80, label: 'Casa Segura — deliver the package' },
    ],
  },
  {
    id: 'heat-check',
    title: 'Job 3 · Heat Check',
    giver: 'Lulu Ferrer',
    brief: 'The Policia are watching the strip. Stir up two stars of trouble, then lose them and lay low at the safehouse.',
    objective: 'Reach 2 wanted stars, then escape to Casa Segura',
    pay: ECONOMY.missionPay[2],
    steps: [
      { kind: 'reachWanted', stars: 2, label: 'Cause trouble — reach 2 wanted stars' },
      { kind: 'escapeTo', x: 860, y: 2060, radius: 90, label: 'Lose the heat and reach Casa Segura' },
    ],
  },
  {
    id: 'convoy-cash',
    title: 'Job 4 · Convoy Cash',
    giver: 'Lulu Ferrer',
    brief: 'A dock-crew convoy dropped its cash bags across the city. Grab all three bags — the green glows on your map.',
    objective: 'Collect the 3 cash bags',
    pay: ECONOMY.missionPay[3],
    steps: [
      { kind: 'collect', points: [[2050, 860], [420, 1660], [1680, 2060]], label: 'Cash bag' },
    ],
  },
  {
    id: 'neon-finale',
    title: 'Job 5 · Neon Finale',
    giver: 'Lulu Ferrer',
    brief: 'Last run. Hit the three neon checkpoints, then floor it to Palma Bay Marina. The boat leaves with or without you.',
    objective: 'Hit the checkpoints, then reach the Marina',
    pay: ECONOMY.missionPay[4],
    steps: [
      { kind: 'checkpoints', points: [[840, 420], [2040, 420], [2040, 1240]], label: 'Neon checkpoint' },
      { kind: 'goto', x: 2720, y: 1780, radius: 110, label: 'Palma Bay Marina — catch the boat' },
    ],
  },
];

export function createMissionState(savedIndex = 0) {
  return {
    index: Math.min(savedIndex, MISSIONS.length),
    stepIndex: 0,
    collected: 0,
    complete: savedIndex >= MISSIONS.length,
    bannerTimer: 0,
    bannerText: '',
    lastPay: 0,
  };
}

export function currentMission(state) {
  return state.complete ? null : MISSIONS[state.index];
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.stepIndex] || null;
}

export function objectiveText(state) {
  const mission = currentMission(state);
  if (!mission) return 'Free roam — Palma Bay is yours. Steal, cruise, survive.';
  const step = currentStep(state);
  if (!step) return mission.objective;
  if (step.kind === 'collect') return `${step.label}s collected: ${state.collected} / ${step.points.length} — follow the green markers`;
  if (step.kind === 'checkpoints') return `${step.label}s: ${state.collected} / ${step.points.length} — then the Marina`;
  return step.label;
}

export function advanceStep(state) {
  const mission = currentMission(state);
  if (!mission) return { missionDone: false, pay: 0 };
  state.stepIndex += 1;
  state.collected = 0;
  if (state.stepIndex >= mission.steps.length) {
    const pay = mission.pay;
    state.index += 1;
    state.stepIndex = 0;
    state.lastPay = pay;
    if (state.index >= MISSIONS.length) state.complete = true;
    return { missionDone: true, pay };
  }
  return { missionDone: false, pay: 0 };
}

export function stepTarget(state) {
  // The single world point the HUD arrow and minimap should point at.
  const step = currentStep(state);
  if (!step) return null;
  if (step.kind === 'goto' || step.kind === 'escapeTo') return { x: step.x, y: step.y, label: step.label };
  if (step.kind === 'collect' || step.kind === 'checkpoints') {
    const p = step.points[state.collected];
    return p ? { x: p[0], y: p[1], label: step.label } : null;
  }
  if (step.kind === 'enterMarkedCar') return { x: 460, y: 800, label: step.label };
  return null;
}
