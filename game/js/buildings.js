const BUILDINGS = [
  {
    id: 'guard_post',
    name: 'Guard Post',
    desc: 'Place a permanent guard. Counts as a soldier for row clears but never marches away. Troops can pass through.',
    effectLabel: 'Permanent guard',
    icon: 'assets/worker.png',
    sprite: 'assets/worker.png',
    costCoins: 0,
    costWood: 8,
    actsAsSoldier: true,
  },
  {
    id: 'gold_mine',
    name: 'Gold Mine',
    desc: 'Place on the battlefield. Generates 1 coin every 12 seconds. Troops can pass through.',
    effectLabel: '+1 coin / 12s',
    icon: 'assets/gold_mine.png',
    sprite: 'assets/gold_mine.png',
    costCoins: 0,
    costWood: 5,
    productionInterval: 12000,
    production: { coins: 1 },
  },
];

function getBuilding(id) {
  return BUILDINGS.find(b => b.id === id) || null;
}

function createEmptyBuildings() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function getBuildingAt(buildings, row, col) {
  if (!buildings || row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
  return buildings[row][col];
}

function canPlaceBuilding(board, buildings, terrainMap, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  if (board[row][col] !== null) return false;
  if (getBuildingAt(buildings, row, col)) return false;
  if (isBlockedTerrain(terrainMap, row, col)) return false;
  return true;
}

function placeBuildingOnGrid(buildings, row, col, buildingId) {
  const next = buildings.map(r => [...r]);
  next[row][col] = buildingId;
  return next;
}

function countBuildingPlaceableCells(board, buildings, terrainMap) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (canPlaceBuilding(board, buildings, terrainMap, r, c)) count++;
    }
  }
  return count;
}

function isRowFullWithBuildings(board, buildings, row, terrainMap = null) {
  for (let c = 0; c < COLS; c++) {
    if (isBlockedTerrain(terrainMap, row, c)) continue;
    const unit = board[row][c];
    const buildingId = getBuildingAt(buildings, row, c);
    const guardFill = buildingId && getBuilding(buildingId)?.actsAsSoldier;
    if (unit === null && !guardFill) return false;
  }
  return true;
}

function findFullRowsWithBuildings(board, buildings, terrainMap = null) {
  const full = [];
  for (let r = 0; r < ROWS; r++) {
    if (isRowFullWithBuildings(board, buildings, r, terrainMap)) full.push(r);
  }
  return full;
}

function shiftBuildingsAfterClear(buildings, clearedRows) {
  const saved = buildings.map(r => [...r]);
  const persisted = [];

  for (const row of clearedRows) {
    for (let c = 0; c < COLS; c++) {
      if (saved[row][c]) {
        persisted.push({ id: saved[row][c], col: c });
        saved[row][c] = null;
      }
    }
  }

  let next = saved.map(r => [...r]);
  const sorted = [...clearedRows].sort((a, b) => b - a);
  for (const row of sorted) {
    next.splice(row, 1);
    next.unshift(Array(COLS).fill(null));
  }

  for (const item of persisted) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!next[r][item.col]) {
        next[r][item.col] = item.id;
        break;
      }
    }
  }

  return next;
}

function formatBuildingCost(building) {
  const parts = [];
  if (building.costCoins > 0) {
    parts.push(`<img src="assets/coins.gif" alt="">${building.costCoins}`);
  }
  if (building.costWood > 0) {
    parts.push(`<img src="assets/wood.png" alt="">${building.costWood}`);
  }
  return parts.join(' ');
}

function canAffordBuilding(coins, wood, building) {
  return coins >= building.costCoins && wood >= building.costWood;
}
