const CHARACTER_SLOTS = ['breaker', 'chrono', 'forge', 'tactician', 'rally'];

const LEGACY_SLOT_MAP = {
  ironwall: 'breaker',
  blacksmith: 'forge',
};

const CHARACTERS = [
  // ── Breaker · Frontline ──
  {
    id: 'ironwall',
    slot: 'breaker',
    tier: 'base',
    unlockClears: 0,
    name: 'Iron Wall',
    title: 'Breaker General',
    desc: 'Clear the bottom 2 rows. Make room when the field is crowded.',
    effectLabel: 'Clear 2 bottom rows',
    icon: 'assets/characters/ironwall.gif',
    sound: 'assets/audio/ironwall.wav',
  },
  {
    id: 'champion',
    slot: 'breaker',
    tier: 'elite',
    unlockClears: 1,
    name: 'Champion',
    title: 'Legendary Breaker',
    desc: 'Clear the bottom 3 rows and gain 10 seconds. A true battlefield legend.',
    effectLabel: 'Clear 3 rows + 10s',
    icon: 'assets/champion.gif',
    sound: 'assets/audio/ironwall.wav',
  },
  {
    id: 'ravager',
    slot: 'breaker',
    tier: 'legendary',
    unlockClears: 3,
    name: 'Ravager',
    title: 'Scorched Earth',
    desc: 'Clear 4 bottom rows and salvage 12 wood from the wreckage.',
    effectLabel: 'Clear 4 rows + 12 wood',
    icon: 'assets/champion.gif',
    sound: 'assets/audio/ironwall.wav',
  },

  // ── Chrono · Time ──
  {
    id: 'chrono',
    slot: 'chrono',
    tier: 'base',
    unlockClears: 0,
    name: 'Chronomancer',
    title: 'Time Strategist',
    desc: 'Add 60 seconds to the clock. Turn the tide when time runs low.',
    effectLabel: '+60s instantly',
    icon: 'assets/characters/chronomancer.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },
  {
    id: 'archmage',
    slot: 'chrono',
    tier: 'elite',
    unlockClears: 5,
    name: 'Archmage',
    title: 'Grand Time Lord',
    desc: 'Add 90 seconds to the clock. Master of temporal strategy.',
    effectLabel: '+90s instantly',
    icon: 'assets/characters/chronomancer.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },
  {
    id: 'timewarden',
    slot: 'chrono',
    tier: 'legendary',
    unlockClears: 10,
    name: 'Time Warden',
    title: 'Gravity Binder',
    desc: 'Add 45 seconds and slow falling speed by half for 20 seconds.',
    effectLabel: '+45s · Slow fall 20s',
    icon: 'assets/characters/chronomancer.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },

  // ── Forge · Support ──
  {
    id: 'blacksmith',
    slot: 'forge',
    tier: 'base',
    unlockClears: 0,
    name: 'Blacksmith',
    title: 'Forge Patch',
    desc: 'Place 3 soldiers on empty cells you choose. Patch gaps to complete a row.',
    effectLabel: 'Place 3 soldiers',
    icon: 'assets/characters/blacksmith.gif',
    sound: 'assets/audio/blacksmith.wav',
  },
  {
    id: 'mastersmith',
    slot: 'forge',
    tier: 'elite',
    unlockClears: 15,
    name: 'Master Smith',
    title: 'Grand Forge',
    desc: 'Place 5 soldiers on empty cells. Forge an entire battle line.',
    effectLabel: 'Place 5 soldiers',
    icon: 'assets/characters/blacksmith.gif',
    sound: 'assets/audio/blacksmith.wav',
  },
  {
    id: 'siegeengineer',
    slot: 'forge',
    tier: 'legendary',
    unlockClears: 20,
    name: 'Siege Engineer',
    title: 'Gap Sealer',
    desc: 'Fill every hole in the lowest occupied row and gain 8 seconds.',
    effectLabel: 'Seal bottom gaps + 8s',
    icon: 'assets/characters/blacksmith.gif',
    sound: 'assets/audio/blacksmith.wav',
  },

  // ── Tactics · Command ──
  {
    id: 'strategist',
    slot: 'tactician',
    tier: 'base',
    unlockClears: 0,
    name: 'Strategist',
    title: 'Battle Planner',
    desc: 'Grant 5 extra move/rotate keys on the next formation.',
    effectLabel: '+5 keys next piece',
    icon: 'assets/champion.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },
  {
    id: 'fieldmarshal',
    slot: 'tactician',
    tier: 'elite',
    unlockClears: 25,
    name: 'Field Marshal',
    title: 'Tactical Commander',
    desc: 'Grant 8 extra keys on the next formation plus 5 seconds.',
    effectLabel: '+8 keys next · +5s',
    icon: 'assets/champion.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },
  {
    id: 'warsage',
    slot: 'tactician',
    tier: 'legendary',
    unlockClears: 30,
    name: 'War Sage',
    title: 'Fate Weaver',
    desc: 'Instantly reroll the current formation and grant 3 keys on the next piece.',
    effectLabel: 'Reroll piece · +3 keys',
    icon: 'assets/characters/chronomancer.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },

  // ── Rally · Supply ──
  {
    id: 'merchant',
    slot: 'rally',
    tier: 'base',
    unlockClears: 0,
    name: 'Merchant',
    title: 'Lumber Broker',
    desc: 'Sign a supply pact: gain 10 wood now, plus 3 bonus wood on each of your next 3 line clears.',
    effectLabel: '+10 wood · +3/clear ×3',
    icon: 'assets/characters/merchant.png',
    sound: 'assets/audio/blacksmith.wav',
  },
  {
    id: 'quartermaster',
    slot: 'rally',
    tier: 'elite',
    unlockClears: 35,
    name: 'Quartermaster',
    title: 'Supply Chief',
    desc: 'Gain 9 coins and 15 wood for buildings.',
    effectLabel: '+9 coins · +15 wood',
    icon: 'assets/wood.png',
    sound: 'assets/audio/blacksmith.wav',
  },
  {
    id: 'oracle',
    slot: 'rally',
    tier: 'legendary',
    unlockClears: 40,
    name: 'Oracle',
    title: 'Morale Herald',
    desc: 'Rally troops to maximum morale and gain 15 seconds.',
    effectLabel: 'Morale ×3 · +15s',
    icon: 'assets/champion.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },
];

function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || null;
}

function getCharactersForSlot(slot) {
  return CHARACTERS.filter(c => c.slot === slot);
}

function getBaseCharacter(slot) {
  return CHARACTERS.find(c => c.slot === slot && c.tier === 'base') || null;
}

function isCharacterUnlocked(char, totalClears) {
  return totalClears >= char.unlockClears;
}

function getActiveRoster(loadout, totalClears) {
  return CHARACTER_SLOTS.map(slot => {
    const preferredId = loadout?.[slot];
    const preferred = preferredId ? getCharacter(preferredId) : null;
    if (preferred && preferred.slot === slot && isCharacterUnlocked(preferred, totalClears)) {
      return preferred;
    }
    const base = getBaseCharacter(slot);
    if (base && isCharacterUnlocked(base, totalClears)) {
      return base;
    }
    return getCharactersForSlot(slot).find(c => isCharacterUnlocked(c, totalClears)) || null;
  }).filter(Boolean);
}

function getSkillParams(charId) {
  switch (charId) {
    case 'ironwall':
      return { type: 'clearBottom', rows: 2, timeBonus: 0 };
    case 'champion':
      return { type: 'clearBottom', rows: 3, timeBonus: 10 };
    case 'ravager':
      return { type: 'clearBottom', rows: 4, timeBonus: 0, wood: 12 };
    case 'chrono':
      return { type: 'addTime', seconds: 60 };
    case 'archmage':
      return { type: 'addTime', seconds: 90 };
    case 'timewarden':
      return { type: 'slowTime', seconds: 45, slowDuration: 20, slowMultiplier: 2 };
    case 'blacksmith':
      return { type: 'place', count: 3 };
    case 'mastersmith':
      return { type: 'place', count: 5 };
    case 'siegeengineer':
      return { type: 'fillBottomGaps', timeBonus: 8 };
    case 'strategist':
      return { type: 'addKeys', keys: 5 };
    case 'fieldmarshal':
      return { type: 'addKeys', keys: 8, timeBonus: 5 };
    case 'warsage':
      return { type: 'rerollPiece', keys: 3 };
    case 'merchant':
      return { type: 'supplyContract', upfrontWood: 10, bonusWoodPerClear: 3, bonusClears: 3 };
    case 'quartermaster':
      return { type: 'addResources', coins: 9, wood: 15 };
    case 'oracle':
      return { type: 'rallyMorale', morale: 3, timeBonus: 15 };
    default:
      return null;
  }
}

function migrateLoadoutSlot(slot) {
  return LEGACY_SLOT_MAP[slot] || slot;
}
