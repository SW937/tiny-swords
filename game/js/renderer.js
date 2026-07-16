const SPRITE_PATHS = {
  pawn:         'assets/pawn.png',
  warrior:      'assets/warrior.png',
  archer:       'assets/archer.png',
  lancer:       'assets/lancer.png',
  monk:         'assets/monk.png',
  pawn_axe:     'assets/pawn_axe.png',
  pawn_hammer:  'assets/pawn_hammer.png',
};

const SPRITE_FRAMES = {
  pawn: 8,
  warrior: 6,
  archer: 6,
  lancer: 12,
  monk: 6,
  pawn_axe: 8,
  pawn_hammer: 8,
};

const UNIT_DRAW_SCALE = 0.92;

const UNIT_COLORS = {
  pawn:        '#4A90D9',
  warrior:     '#E04545',
  archer:      '#3CB371',
  lancer:      '#E8A020',
  monk:        '#9B59D0',
  pawn_axe:    '#1ABC9C',
  pawn_hammer: '#E67E22',
};

const BUILDING_SPRITES = {
  guard_post: 'assets/worker.png',
  gold_mine: 'assets/gold_mine.png',
};

const BUILDING_COLORS = {
  guard_post: '#7a9e2e',
  gold_mine: '#d4a017',
};
const TERRAIN_TILE = 64;
const GRASS_TILE = { sx: 0, sy: 0 };
const SAND_TILE = { sx: 384, sy: 0 };

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = 40;
    this.sprites = {};
    this.terrain = null;
    this.loaded = false;

    this.marchAnimations = [];
    this.dropAnimations = [];
    this.terrainAnimPhase = 0;

    this.resize();
  }

  resize() {
    this.cellSize = Math.min(
      Math.floor((window.innerHeight - 130) / ROWS),
      Math.floor((window.innerWidth - 360) / (COLS + 2)),
      64
    );
    this.cellSize = Math.max(this.cellSize, 36);
    this.canvas.width = COLS * this.cellSize;
    this.canvas.height = ROWS * this.cellSize;
  }

  loadImage(path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`Failed to load: ${path}`);
        resolve(null);
      };
      img.src = path;
    });
  }

  async loadSprites() {
    const unitPromises = Object.entries(SPRITE_PATHS).map(async ([type, path]) => {
      const img = await this.loadImage(path);
      if (img) this.sprites[type] = img;
    });

    const buildingPromises = Object.entries(BUILDING_SPRITES).map(async ([type, path]) => {
      const img = await this.loadImage(path);
      if (img) this.sprites[`building_${type}`] = img;
    });

    await Promise.all([...unitPromises, ...buildingPromises]);
    this.terrain = await this.loadImage('assets/terrain.png');
    this.loaded = true;
  }

  update(dt) {
    this.marchAnimations = this.marchAnimations.filter(a => {
      a.progress += dt / 600;
      return a.progress < 1;
    });

    this.dropAnimations = this.dropAnimations.filter(a => {
      a.progress += dt / 300;
      return a.progress < 1;
    });

    this.terrainAnimPhase += dt * 0.004;
  }

  addMarchAnimation(row) {
    this.marchAnimations.push({ row, progress: 0 });
  }

  addDropAnimation(fromRow, toRow) {
    for (let r = fromRow; r <= toRow; r++) {
      this.dropAnimations.push({ row: r, progress: 0, delay: (r - fromRow) * 50 });
    }
  }

  drawBoard(board, currentFormation, currentRow, currentCol, ghost = true, placementState = null, terrainMap = null, buildings = null) {
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground(ctx, cs, terrainMap);

    if (buildings) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const buildingId = buildings[r][c];
          if (buildingId) {
            this.drawBuilding(ctx, r, c, cs, buildingId);
          }
        }
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const unit = board[r][c];
        if (unit) {
          const marchAnim = this.marchAnimations.find(a => a.row === r);
          let offsetX = 0;
          if (marchAnim) {
            offsetX = marchAnim.progress * (COLS * cs + cs);
          }
          this.drawUnit(ctx, r, c, cs, unit, offsetX);
        }
      }
    }

    if (currentFormation && ghost) {
      const ghostRow = this.getGhostRow(board, currentFormation, currentRow, currentCol, terrainMap);
      if (ghostRow !== currentRow) {
        for (const block of currentFormation.blocks) {
          const r = ghostRow + block.row;
          const c = currentCol + block.col;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            this.drawUnit(ctx, r, c, cs, currentFormation.unit, 0, 0.3);
          }
        }
      }
    }

    if (currentFormation) {
      for (const block of currentFormation.blocks) {
        const r = currentRow + block.row;
        const c = currentCol + block.col;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          this.drawUnit(ctx, r, c, cs, currentFormation.unit);
        } else if (r < 0) {
          this.drawUnit(ctx, r, c, cs, currentFormation.unit);
        }
      }
    }

    if (placementState) {
      if (placementState.mode === 'blacksmith') {
        this.drawForgeOverlay(ctx, board, cs, placementState, terrainMap);
      } else if (placementState.mode === 'building') {
        this.drawBuildingPlacementOverlay(ctx, board, buildings, cs, placementState, terrainMap);
      }
    }
  }

  drawBuilding(ctx, r, c, cs, buildingId, alpha = 1) {
    const x = c * cs;
    const y = r * cs;
    const color = BUILDING_COLORS[buildingId] || '#888';
    const drawSize = cs * UNIT_DRAW_SCALE;
    const drawX = x + (cs - drawSize) / 2;
    const drawY = y + (cs - drawSize) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    const sprite = this.sprites[`building_${buildingId}`];
    if (sprite) {
      const frameW = sprite.width;
      const frameH = sprite.height;
      ctx.drawImage(sprite, 0, 0, frameW, frameH, drawX, drawY, drawSize, drawSize);
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillRect(drawX, drawY, drawSize, drawSize);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(drawX, drawY, drawSize, drawSize);
    }

    ctx.restore();
  }

  drawBuildingPlacementOverlay(ctx, board, buildings, cs, { hover, buildingId }, terrainMap = null) {
    const building = getBuilding(buildingId);
    const tint = building?.actsAsSoldier ? 'rgba(122, 158, 46, 0.18)' : 'rgba(212, 160, 23, 0.18)';

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!canPlaceBuilding(board, buildings, terrainMap, r, c)) continue;
        ctx.fillStyle = tint;
        ctx.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2);
      }
    }

    if (hover && canPlaceBuilding(board, buildings, terrainMap, hover.row, hover.col)) {
      this.drawBuilding(ctx, hover.row, hover.col, cs, buildingId, 0.55);
      ctx.strokeStyle = '#f5c842';
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.col * cs + 1, hover.row * cs + 1, cs - 2, cs - 2);
    }

    if (building) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(8, 8, 168, 28);
      ctx.fillStyle = '#f5c842';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Place: ${building.name}`, 16, 14);
      ctx.restore();
    }
  }

  drawForgeOverlay(ctx, board, cs, { hover, remaining }, terrainMap = null) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== null || isBlockedTerrain(terrainMap, r, c)) continue;
        ctx.fillStyle = 'rgba(230, 126, 34, 0.18)';
        ctx.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2);
      }
    }

    if (hover && board[hover.row]?.[hover.col] === null && !isBlockedTerrain(terrainMap, hover.row, hover.col)) {
      this.drawUnit(ctx, hover.row, hover.col, cs, 'pawn_hammer', 0, 0.55);
      ctx.strokeStyle = '#f5c842';
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.col * cs + 1, hover.row * cs + 1, cs - 2, cs - 2);
    }

    if (remaining > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(8, 8, 118, 28);
      ctx.fillStyle = '#f5c842';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Place: ${remaining}`, 16, 14);
      ctx.restore();
    }
  }

  getGhostRow(board, formation, row, col, terrainMap = null) {
    let ghostRow = row;
    while (canPlace(board, formation, ghostRow + 1, col, terrainMap)) {
      ghostRow++;
    }
    return ghostRow;
  }

  drawBackground(ctx, cs, terrainMap = null) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const terrainType = terrainMap?.[r]?.[c] || TERRAIN.GRASS;
        this.drawTerrainCell(ctx, r, c, cs, terrainType);
      }
    }
  }

  drawTerrainCell(ctx, r, c, cs, terrainType) {
    const x = c * cs;
    const y = r * cs;
    const isSpecial = terrainType !== TERRAIN.GRASS;
    const useGrassBase = isSpecial || (r + c) % 2 === 0;

    if (this.terrain) {
      const tile = useGrassBase ? GRASS_TILE : SAND_TILE;
      ctx.drawImage(
        this.terrain,
        tile.sx, tile.sy, TERRAIN_TILE, TERRAIN_TILE,
        x, y, cs, cs
      );
    } else {
      const shade = useGrassBase ? '#5a9a48' : '#c8a858';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, cs, cs);
    }

    if (!isSpecial) return;

    const visual = TERRAIN_VISUAL[terrainType];
    if (!visual) return;

    ctx.save();

    if (this.terrain) {
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = visual.tint;
      ctx.globalAlpha = visual.alpha;
      ctx.fillRect(x, y, cs, cs);
    } else {
      ctx.fillStyle = visual.fallback;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(x, y, cs, cs);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.drawTerrainPattern(ctx, terrainType, x, y, cs);
    this.drawTerrainBorder(ctx, terrainType, x, y, cs);

    ctx.restore();
  }

  drawTerrainPattern(ctx, terrainType, x, y, cs) {
    const phase = this.terrainAnimPhase;

    if (terrainType === TERRAIN.RIVER) {
      ctx.fillStyle = 'rgba(140, 210, 255, 0.55)';
      for (let i = 0; i < 3; i++) {
        const waveY = y + Math.floor(cs * (0.22 + i * 0.26) + Math.sin(phase + i * 1.2) * 2);
        ctx.fillRect(x + 3, waveY, cs - 6, Math.max(2, Math.floor(cs * 0.06)));
      }
      ctx.fillStyle = 'rgba(200, 235, 255, 0.35)';
      ctx.fillRect(x + Math.floor(cs * 0.15), y + Math.floor(cs * 0.12), Math.floor(cs * 0.3), 2);
      return;
    }

    if (terrainType === TERRAIN.WIND) {
      ctx.strokeStyle = 'rgba(230, 248, 255, 0.75)';
      ctx.lineWidth = Math.max(2, Math.floor(cs * 0.05));
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const drift = ((phase * 18 + i * 10) % (cs + 8)) - 4;
        const baseY = y + Math.floor(cs * (0.28 + i * 0.22));
        ctx.beginPath();
        ctx.moveTo(x + drift, baseY);
        ctx.quadraticCurveTo(
          x + cs * 0.45 + drift * 0.3,
          baseY - cs * 0.12,
          x + cs + drift - 6,
          baseY + cs * 0.06
        );
        ctx.stroke();
      }
      return;
    }

    if (terrainType === TERRAIN.MOUNTAIN) {
      const peaks = [
        [0.08, 0.42, 0.22, 0.28],
        [0.30, 0.48, 0.24, 0.32],
        [0.56, 0.40, 0.28, 0.36],
      ];
      for (const [px, py, pw, ph] of peaks) {
        const bx = x + Math.floor(cs * px);
        const by = y + Math.floor(cs * py);
        const bw = Math.floor(cs * pw);
        const bh = Math.floor(cs * ph);
        ctx.fillStyle = 'rgba(45, 38, 30, 0.65)';
        ctx.beginPath();
        ctx.moveTo(bx, by + bh);
        ctx.lineTo(bx + Math.floor(bw * 0.5), by);
        ctx.lineTo(bx + bw, by + bh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(160, 145, 120, 0.45)';
        ctx.fillRect(bx + Math.floor(bw * 0.35), by + 2, Math.max(2, Math.floor(bw * 0.12)), Math.floor(bh * 0.35));
      }
      ctx.fillStyle = 'rgba(35, 28, 22, 0.4)';
      ctx.fillRect(x + 2, y + cs - Math.floor(cs * 0.12), cs - 4, Math.floor(cs * 0.1));
    }
  }

  drawTerrainBorder(ctx, terrainType, x, y, cs) {
    const borderColors = {
      [TERRAIN.RIVER]: 'rgba(20, 70, 130, 0.7)',
      [TERRAIN.WIND]: 'rgba(40, 120, 160, 0.6)',
      [TERRAIN.MOUNTAIN]: 'rgba(25, 20, 15, 0.75)',
    };
    ctx.strokeStyle = borderColors[terrainType] || 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
  }

  drawUnit(ctx, r, c, cs, unitType, offsetX = 0, alpha = 1) {
    const x = c * cs + offsetX;
    const y = r * cs;
    const color = UNIT_COLORS[unitType] || '#888';
    const drawSize = cs * UNIT_DRAW_SCALE;
    const drawX = x + (cs - drawSize) / 2;
    const drawY = y + (cs - drawSize) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    const sprite = this.sprites[unitType];
    if (sprite) {
      const frames = SPRITE_FRAMES[unitType] || 6;
      const frameW = sprite.width / frames;
      const frameH = sprite.height;

      ctx.drawImage(
        sprite,
        0, 0, frameW, frameH,
        drawX, drawY, drawSize, drawSize
      );
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillRect(drawX, drawY, drawSize, drawSize);
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, drawSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawPreview(formation, previewCanvas) {
    if (!previewCanvas) return;
    const shape = formation.shape;
    this.drawShapeOnCanvas(shape, formation.unit, previewCanvas, 44, true);
  }

  drawTaskShape(shape, unit, canvas) {
    if (!canvas) return;
    this.drawShapeOnCanvas(shape, unit, canvas, 22, true);
  }

  drawShapeOnCanvas(shape, unit, canvas, cs, trim = false) {
    const ctx = canvas.getContext('2d');
    const rows = shape.length;
    const cols = shape[0].length;
    canvas.width = cols * cs;
    canvas.height = rows * cs;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (shape[r][c]) {
          this.drawUnit(ctx, r, c, cs, unit);
        }
      }
    }

    if (trim) this.trimCanvas(canvas);
  }

  trimCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    if (!width || !height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    let top = height;
    let left = width;
    let right = 0;
    let bottom = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }

    if (right < left || bottom < top) return;

    const pad = 2;
    left = Math.max(0, left - pad);
    top = Math.max(0, top - pad);
    right = Math.min(width - 1, right + pad);
    bottom = Math.min(height - 1, bottom + pad);

    const trimmedWidth = right - left + 1;
    const trimmedHeight = bottom - top + 1;
    const trimmed = ctx.getImageData(left, top, trimmedWidth, trimmedHeight);

    canvas.width = trimmedWidth;
    canvas.height = trimmedHeight;
    ctx.putImageData(trimmed, 0, 0);
  }
}
