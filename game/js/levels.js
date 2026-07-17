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
const LOADOUT_KEY = 'formation-general-loadout';

const DEFAULT_LOADOUT = {
  breaker: 'ironwall',
  chrono: 'chrono',
  forge: 'blacksmith',
  tactician: 'strategist',
  rally: 'merchant',
};

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

function loadLoadout() {
  try {
    const data = JSON.parse(localStorage.getItem(LOADOUT_KEY));
    if (!data || typeof data !== 'object') return { ...DEFAULT_LOADOUT };
    const loadout = { ...DEFAULT_LOADOUT };
    for (const [rawSlot, charId] of Object.entries(data)) {
      const slot = migrateLoadoutSlot(rawSlot);
      const char = getCharacter(charId);
      if (char && char.slot === slot && CHARACTER_SLOTS.includes(slot)) {
        loadout[slot] = char.id;
      }
    }
    return loadout;
  } catch {
    return { ...DEFAULT_LOADOUT };
  }
}

function saveLoadout(loadout) {
  localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout));
}

function resetProgress() {
  localStorage.removeItem(SAVE_KEY);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const DIFFICULTY_TIER_NAMES = [
  '初征', '再战', '鏖战', '百战', '炼狱', '修罗', '天罚',
];

function getDifficultyTierName(tier) {
  if (tier <= 0) return DIFFICULTY_TIER_NAMES[0];
  return DIFFICULTY_TIER_NAMES[Math.min(tier, DIFFICULTY_TIER_NAMES.length - 1)];
}

function getDifficultyModifiers(totalClears) {
  const tier = Math.max(0, totalClears);
  return {
    tier,
    tierName: getDifficultyTierName(tier),
    timeMultiplier: Math.max(0.7, 1 - tier * 0.05),
    dropSpeedBonus: tier * 30,
    inputPenalty: Math.min(3, Math.floor(tier / 2)),
    extraLines: Math.min(4, Math.floor(tier / 2)),
    extraTerrainCells: Math.min(2, Math.floor(tier / 3)),
  };
}

function getEffectiveLinesRequired(level, totalClears) {
  const mods = getDifficultyModifiers(totalClears);
  return level.linesRequired + mods.extraLines;
}

function formatDifficultyDisplay(totalClears) {
  const mods = getDifficultyModifiers(totalClears);
  if (mods.tier === 0) {
    return `Cleared ${totalClears} times`;
  }
  return `Cleared ${totalClears} times · ${mods.tierName}`;
}
