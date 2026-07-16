const LEVELS = [
  { id: 1,  name: 'Tutorial',            linesRequired: 1,  timeLimit: 180, tutorial: true },
  { id: 2,  name: 'First Drill',         linesRequired: 2,  timeLimit: 200 },
  { id: 3,  name: 'Border Watch',        linesRequired: 3,  timeLimit: 220 },
  { id: 4,  name: 'Cavalry Charge',      linesRequired: 4,  timeLimit: 240 },
  { id: 5,  name: 'Five Generals',       linesRequired: 5,  timeLimit: 260 },
  { id: 6,  name: 'River Crossing',      linesRequired: 6,  timeLimit: 280 },
  { id: 7,  name: 'Last Stand',          linesRequired: 7,  timeLimit: 300 },
  { id: 8,  name: 'Decisive Battle',     linesRequired: 8,  timeLimit: 300 },
  { id: 9,  name: 'Northern Campaign',   linesRequired: 9,  timeLimit: 320 },
  { id: 10, name: 'Unify the Realm',     linesRequired: 10, timeLimit: 360 },
];

const SAVE_KEY = 'formation-general-save';
const TOTAL_CLEARS_KEY = 'formation-general-total-clears';

let sharedClearCount = null;

function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data || typeof data !== 'object') {
      return { unlockedLevel: 1, completedLevels: [] };
    }
    return {
      unlockedLevel: Number.isFinite(data.unlockedLevel) && data.unlockedLevel >= 1
        ? data.unlockedLevel
        : 1,
      completedLevels: Array.isArray(data.completedLevels) ? data.completedLevels : [],
    };
  } catch {
    return { unlockedLevel: 1, completedLevels: [] };
  }
}

function loadTotalClears() {
  if (sharedClearCount !== null) return sharedClearCount;
  try {
    const stored = parseInt(localStorage.getItem(TOTAL_CLEARS_KEY), 10);
    return Number.isFinite(stored) && stored >= 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function cacheTotalClears(count) {
  sharedClearCount = count;
  localStorage.setItem(TOTAL_CLEARS_KEY, String(count));
}

function incrementTotalClearsLocal() {
  const count = loadTotalClears() + 1;
  cacheTotalClears(count);
  return count;
}

async function fetchTotalClears() {
  try {
    const res = await fetch('/api/clears', { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const count = Number.isFinite(data.count) && data.count >= 0 ? data.count : 0;
    cacheTotalClears(count);
    return count;
  } catch {
    return loadTotalClears();
  }
}

async function incrementTotalClears() {
  try {
    const res = await fetch('/api/clears/increment', { method: 'POST' });
    if (!res.ok) throw new Error('increment failed');
    const data = await res.json();
    const count = Number.isFinite(data.count) && data.count >= 0 ? data.count : incrementTotalClearsLocal();
    cacheTotalClears(count);
    return count;
  } catch {
    return incrementTotalClearsLocal();
  }
}

function migrateClearCountFromSave(save) {
  const legacy = save?.clearCount || 0;
  if (legacy > loadTotalClears()) {
    cacheTotalClears(legacy);
  }
}

function saveProgress(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function resetProgress() {
  localStorage.removeItem(SAVE_KEY);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
