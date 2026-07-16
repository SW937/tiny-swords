const TERRAIN = {
  GRASS: 'grass',
  RIVER: 'river',
  WIND: 'wind',
  MOUNTAIN: 'mountain',
};

const TERRAIN_INFO = {
  [TERRAIN.RIVER]: {
    label: 'River',
    hint: 'Touch river: fall speed temporarily increases',
  },
  [TERRAIN.WIND]: {
    label: 'Wind',
    hint: 'Touch wind: fall speed temporarily decreases',
  },
  [TERRAIN.MOUNTAIN]: {
    label: 'Mountain',
    hint: 'Mountain blocks: units cannot pass through',
  },
};

const TERRAIN_VISUAL = {
  [TERRAIN.RIVER]: {
    tint: '#2a7ec0',
    fallback: '#3a8cc8',
    alpha: 0.72,
  },
  [TERRAIN.WIND]: {
    tint: '#5ec0e0',
    fallback: '#6ec8e8',
    alpha: 0.68,
  },
  [TERRAIN.MOUNTAIN]: {
    tint: '#5a4a38',
    fallback: '#6a5a48',
    alpha: 0.82,
  },
};

const RIVER_FALL_MULT = 0.55;
const WIND_FALL_MULT = 1.7;

// 第3–4关1格，第5–6关2格，第7–8关3格，第9–10关4格
const TERRAIN_CELL_POSITIONS = {
  1: [{ r: 14, c: 4 }],
  2: [{ r: 13, c: 3 }, { r: 13, c: 6 }],
  3: [{ r: 12, c: 2 }, { r: 13, c: 5 }, { r: 14, c: 8 }],
  4: [{ r: 11, c: 2 }, { r: 12, c: 5 }, { r: 13, c: 7 }, { r: 14, c: 3 }],
};

const LEVEL_TERRAIN = {
  3: TERRAIN.RIVER,
  4: TERRAIN.RIVER,
  5: TERRAIN.WIND,
  6: TERRAIN.WIND,
  7: TERRAIN.RIVER,
  8: TERRAIN.RIVER,
  9: TERRAIN.MOUNTAIN,
  10: TERRAIN.MOUNTAIN,
};

function getSpecialTerrainType(levelId) {
  return LEVEL_TERRAIN[levelId] || null;
}

function getTerrainCellCount(levelId) {
  if (levelId < 3 || levelId > 10) return 0;
  return Math.floor((levelId - 3) / 2) + 1;
}

function createTerrainMap(levelId) {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(TERRAIN.GRASS));
  const type = getSpecialTerrainType(levelId);
  const count = getTerrainCellCount(levelId);
  if (!type || count === 0) return map;

  const positions = TERRAIN_CELL_POSITIONS[count];
  for (const { r, c } of positions) {
    map[r][c] = type;
  }

  return map;
}

function isBlockedTerrain(terrainMap, row, col) {
  if (!terrainMap || row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  return terrainMap[row][col] === TERRAIN.MOUNTAIN;
}

function getTerrainFallMultiplier(terrainMap, formation, row, col) {
  if (!terrainMap || !formation) return 1;

  let onRiver = false;
  let onWind = false;

  for (const block of formation.blocks) {
    const r = row + block.row;
    const c = col + block.col;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;

    const terrain = terrainMap[r][c];
    if (terrain === TERRAIN.RIVER) onRiver = true;
    if (terrain === TERRAIN.WIND) onWind = true;
  }

  if (onWind) return WIND_FALL_MULT;
  if (onRiver) return RIVER_FALL_MULT;
  return 1;
}

function getTerrainHint(levelId) {
  const type = getSpecialTerrainType(levelId);
  if (!type) return null;
  return TERRAIN_INFO[type];
}

function countPlaceableCells(board, terrainMap) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === null && !isBlockedTerrain(terrainMap, r, c)) count++;
    }
  }
  return count;
}
