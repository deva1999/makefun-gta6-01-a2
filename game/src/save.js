// Progress kept in the browser: money, story progress, respect and
// lifetime stats survive a reload through localStorage. Saving is
// automatic after every mission, pickup and bust.

const KEY = 'palma-bay-neon-tide-v1';

export function defaultSave() {
  return {
    money: 120,
    missionIndex: 0,
    respect: 0,
    carsStolen: 0,
    missionsDone: 0,
    timesBusted: 0,
    timesWasted: 0,
    bestWanted: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { save: defaultSave(), exists: false };
    const parsed = JSON.parse(raw);
    return { save: { ...defaultSave(), ...parsed }, exists: true };
  } catch {
    return { save: defaultSave(), exists: false };
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or quota: the game still plays, it just forgets.
  }
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to wipe */ }
}
