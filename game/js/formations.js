const COLS = 10;
const ROWS = 18;

const UNIT_TYPES = ['pawn', 'warrior', 'archer', 'lancer', 'monk', 'pawn_axe', 'pawn_hammer'];

const UNIT_NAMES = {
  pawn: 'Pawns',
  warrior: 'Warriors',
  archer: 'Archers',
  lancer: 'Lancers',
  monk: 'Monks',
  pawn_axe: 'Axemen',
  pawn_hammer: 'Hammer Guard',
};

const FORMATION_DEFS = [
  {
    name: 'Snake Line',
    unit: 'pawn',
    shapes: [
      [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
      [[0,0,1,0], [0,0,1,0], [0,0,1,0], [0,0,1,0]],
    ],
  },
  {
    name: 'Square Block',
    unit: 'warrior',
    shapes: [
      [[1,1], [1,1]],
    ],
  },
  {
    name: 'Flying Geese',
    unit: 'archer',
    shapes: [
      [[0,1,0], [1,1,1], [0,0,0]],
      [[0,1,0], [0,1,1], [0,1,0]],
      [[0,0,0], [1,1,1], [0,1,0]],
      [[0,1,0], [1,1,0], [0,1,0]],
    ],
  },
  {
    name: 'Crescent',
    unit: 'lancer',
    shapes: [
      [[1,0,0], [1,1,1], [0,0,0]],
      [[0,1,1], [0,1,0], [0,1,0]],
      [[0,0,0], [1,1,1], [0,0,1]],
      [[0,1,0], [0,1,0], [1,1,0]],
    ],
  },
  {
    name: 'Hook',
    unit: 'monk',
    shapes: [
      [[0,0,1], [1,1,1], [0,0,0]],
      [[0,1,0], [0,1,0], [0,1,1]],
      [[0,0,0], [1,1,1], [1,0,0]],
      [[1,1,0], [0,1,0], [0,1,0]],
    ],
  },
  {
    name: 'Fish Scale',
    unit: 'pawn_axe',
    shapes: [
      [[0,1,1], [1,1,0], [0,0,0]],
      [[0,1,0], [0,1,1], [0,0,1]],
      [[0,0,0], [0,1,1], [1,1,0]],
      [[1,0,0], [1,1,0], [0,1,0]],
    ],
  },
  {
    name: 'Wedge',
    unit: 'pawn_hammer',
    shapes: [
      [[1,1,0], [0,1,1], [0,0,0]],
      [[0,0,1], [0,1,1], [0,1,0]],
      [[0,0,0], [1,1,0], [0,1,1]],
      [[0,1,0], [1,1,0], [1,0,0]],
    ],
  },
];

class Formation {
  constructor(defIndex, rotation = 0) {
    this.defIndex = defIndex;
    this.rotation = rotation;
    this.def = FORMATION_DEFS[defIndex];
  }

  get shape() {
    return this.def.shapes[this.rotation % this.def.shapes.length];
  }

  get name() {
    return this.def.name;
  }

  get unit() {
    return this.def.unit;
  }

  get blocks() {
    const s = this.shape;
    const blocks = [];
    for (let r = 0; r < s.length; r++) {
      for (let c = 0; c < s[r].length; c++) {
        if (s[r][c]) blocks.push({ row: r, col: c });
      }
    }
    return blocks;
  }

  rotate() {
    this.rotation = (this.rotation + 1) % this.def.shapes.length;
  }

  clone() {
    const f = new Formation(this.defIndex, this.rotation);
    return f;
  }
}

function randomFormation() {
  const idx = Math.floor(Math.random() * FORMATION_DEFS.length);
  return new Formation(idx);
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function canPlace(board, formation, row, col, terrainMap = null) {
  for (const block of formation.blocks) {
    const r = row + block.row;
    const c = col + block.col;
    if (c < 0 || c >= COLS || r >= ROWS) return false;
    if (r >= 0 && board[r][c] !== null) return false;
    if (r >= 0 && isBlockedTerrain(terrainMap, r, c)) return false;
  }
  return true;
}

function hasBlocksAboveBoard(formation, row) {
  return formation.blocks.some(block => row + block.row < 0);
}

function placeFormation(board, formation, row, col) {
  const newBoard = board.map(r => [...r]);
  for (const block of formation.blocks) {
    const r = row + block.row;
    const c = col + block.col;
    if (r >= 0) {
      newBoard[r][c] = formation.unit;
    }
  }
  return newBoard;
}

function findFullRows(board) {
  const full = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== null)) {
      full.push(r);
    }
  }
  return full;
}

function isUnifiedRow(board, row, terrainMap = null) {
  let firstUnit = null;
  for (let c = 0; c < COLS; c++) {
    if (isBlockedTerrain(terrainMap, row, c)) continue;
    const unit = board[row][c];
    if (unit === null) return false;
    if (firstUnit === null) firstUnit = unit;
    else if (unit !== firstUnit) return false;
  }
  return firstUnit !== null;
}

function getUnifiedRows(board, rows, terrainMap = null) {
  return rows.filter(row => isUnifiedRow(board, row, terrainMap));
}

function clearRows(board, rows) {
  const newBoard = board.map(r => [...r]);
  const sorted = [...rows].sort((a, b) => a - b);
  for (let i = sorted.length - 1; i >= 0; i--) {
    newBoard.splice(sorted[i], 1);
    newBoard.unshift(Array(COLS).fill(null));
  }
  return newBoard;
}

function clearBottomRows(board, count) {
  const newBoard = board.map(r => [...r]);
  const rowsToClear = Math.min(count, ROWS);
  for (let i = 0; i < rowsToClear; i++) {
    newBoard.pop();
    newBoard.unshift(Array(COLS).fill(null));
  }
  return newBoard;
}

function placeCell(board, row, col, unit) {
  const newBoard = board.map(r => [...r]);
  if (row >= 0 && row < ROWS && col >= 0 && col < COLS && newBoard[row][col] === null) {
    newBoard[row][col] = unit;
  }
  return newBoard;
}

function countEmptyCells(board) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === null) count++;
    }
  }
  return count;
}

function fillEmptyCells(board, count, unit = 'pawn_hammer') {
  const newBoard = board.map(r => [...r]);
  let filled = 0;
  for (let r = ROWS - 1; r >= 0 && filled < count; r--) {
    for (let c = 0; c < COLS && filled < count; c++) {
      if (newBoard[r][c] === null) {
        newBoard[r][c] = unit;
        filled++;
      }
    }
  }
  return { board: newBoard, filled };
}

function canPlaceAny(board, terrainMap = null) {
  for (let defIdx = 0; defIdx < FORMATION_DEFS.length; defIdx++) {
    const def = FORMATION_DEFS[defIdx];
    for (let rot = 0; rot < def.shapes.length; rot++) {
      const f = new Formation(defIdx, rot);
      for (let r = -f.shape.length; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (canPlace(board, f, r, c, terrainMap)) return true;
        }
      }
    }
  }
  return false;
}
