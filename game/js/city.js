const CITY_CYCLE_MS = 10000;
const BUILDING_DRAW_SCALE = 1.05;

class CityPanel {
  constructor(canvas, onProduce) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onProduce = onProduce;
    this.active = false;
    this.elapsed = 0;
    this.images = {};
    this.loaded = false;
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

  async load() {
    const [castle, coin, wood] = await Promise.all([
      this.loadImage('assets/castle.png'),
      this.loadImage('assets/coins.gif'),
      this.loadImage('assets/wood.png'),
    ]);
    this.images.castle = castle;
    this.images.coin = coin;
    this.images.wood = wood;
    this.loaded = true;
  }

  resize(cellSize) {
    const cs = cellSize;
    this.canvas.width = cs * 2.6;
    this.canvas.height = cs * 2.75;
    this.panelW = this.canvas.width;
    this.panelH = this.canvas.height;
    this.cellSize = cs;
  }

  start() {
    this.active = true;
    this.elapsed = 0;
  }

  stop() {
    this.active = false;
  }

  getCycleProgress() {
    const cycleElapsed = this.elapsed % CITY_CYCLE_MS;
    return cycleElapsed / CITY_CYCLE_MS;
  }

  getSecondsRemaining() {
    const cycleElapsed = this.elapsed % CITY_CYCLE_MS;
    const remainingMs = CITY_CYCLE_MS - cycleElapsed;
    return Math.max(1, Math.ceil(remainingMs / 1000));
  }

  update(dt) {
    if (!this.active || !this.loaded) return;

    const prevElapsed = this.elapsed;
    this.elapsed += dt;

    const prevCycle = Math.floor(prevElapsed / CITY_CYCLE_MS);
    const currCycle = Math.floor(this.elapsed / CITY_CYCLE_MS);
    if (currCycle > prevCycle) {
      this.onProduce({ coins: 1, wood: 1 });
    }
  }

  drawSprite(img, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (!img) return;
    this.ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  drawBuilding(img, cx, cy, targetW, targetH) {
    if (!img) return;
    const scale = BUILDING_DRAW_SCALE;
    const dw = targetW * scale;
    const dh = targetH * scale;
    this.drawSprite(
      img,
      0, 0, img.width, img.height,
      cx - dw / 2, cy - dh / 2, dw, dh
    );
  }

  drawProductionHint(ctx, cx, cs) {
    const iconSize = Math.max(14, cs * 0.32);
    const iconY = cs * 1.82;
    const gap = iconSize * 0.35;
    const subSize = Math.max(8, cs * 0.2);

    ctx.font = `${subSize}px sans-serif`;
    ctx.textAlign = 'left';
    const prefix = 'Every 10s';
    const prefixW = ctx.measureText(prefix).width;
    const plusW = ctx.measureText('+1').width;
    const totalW = prefixW + iconSize + plusW + gap + iconSize + plusW + gap * 2;
    let ix = cx - totalW / 2;

    ctx.fillStyle = '#8a7a50';
    ctx.fillText(prefix, ix, iconY + iconSize * 0.72);
    ix += prefixW + gap;

    if (this.images.coin) {
      ctx.drawImage(this.images.coin, ix, iconY, iconSize, iconSize);
      ix += iconSize + gap * 0.5;
    }
    ctx.fillStyle = '#ffd040';
    ctx.fillText('+1', ix, iconY + iconSize * 0.72);
    ix += plusW + gap;

    if (this.images.wood) {
      ctx.drawImage(this.images.wood, ix, iconY, iconSize, iconSize);
      ix += iconSize + gap * 0.5;
    }
    ctx.fillStyle = '#c8a060';
    ctx.fillText('+1', ix, iconY + iconSize * 0.72);
  }

  drawProgressBar(ctx, w, h, cs) {
    const progress = this.getCycleProgress();
    const secondsLeft = this.getSecondsRemaining();
    const padX = cs * 0.18;
    const barW = w - padX * 2;
    const barH = Math.max(10, cs * 0.24);
    const barX = padX;
    const barY = h - cs * 0.52;
    const labelSize = Math.max(7, cs * 0.17);
    const almostDone = secondsLeft <= 2;

    ctx.textAlign = 'center';
    ctx.font = `${labelSize}px sans-serif`;
    ctx.fillStyle = almostDone ? '#ffd040' : '#8a7a50';
    ctx.fillText(`Next in ${secondsLeft}s`, w / 2, barY - cs * 0.1);

    ctx.fillStyle = '#1a1208';
    ctx.strokeStyle = '#5a4a28';
    ctx.lineWidth = 1;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    const fillW = Math.max(0, (barW - 2) * progress);
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      grad.addColorStop(0, almostDone ? '#ffb830' : '#c8942a');
      grad.addColorStop(1, almostDone ? '#ffe878' : '#ffd040');
      ctx.fillStyle = grad;
      ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);
    }

    const rewardIcon = Math.max(10, cs * 0.2);
    const iconY = barY + (barH - rewardIcon) / 2;
    if (this.images.coin) {
      ctx.drawImage(this.images.coin, barX + barW - rewardIcon * 2 - 4, iconY, rewardIcon, rewardIcon);
    }
    if (this.images.wood) {
      ctx.drawImage(this.images.wood, barX + barW - rewardIcon - 2, iconY, rewardIcon, rewardIcon);
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.panelW;
    const h = this.panelH;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    const cs = this.cellSize;
    const cx = w / 2;
    const labelSize = Math.max(9, cs * 0.26);

    ctx.fillStyle = 'rgba(26, 18, 8, 0.94)';
    ctx.strokeStyle = '#8a7030';
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeRect(1, 1, w - 2, h - 2);

    ctx.strokeStyle = '#ffd040';
    ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5e6c8';
    ctx.font = `bold ${labelSize}px 'Press Start 2P', sans-serif`;
    ctx.fillText('Main City', cx, cs * 0.34);

    const castleW = cs * 2.0;
    const castleH = cs * 1.55;
    this.drawBuilding(this.images.castle, cx, cs * 1.12, castleW, castleH);

    this.drawProductionHint(ctx, cx, cs);
    this.drawProgressBar(ctx, w, h, cs);
  }
}
