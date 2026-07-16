const TASK_POOL = [
  { shape: [[1, 1], [1, 1]], unit: 'warrior', reward: 'move', rewardLabel: 'Move ×1' },
  { shape: [[1, 1, 1, 1]], unit: 'pawn', reward: 'move', rewardLabel: 'Move ×1' },
  { shape: [[0, 1, 0], [1, 1, 1]], unit: 'archer', reward: 'rotate', rewardLabel: 'Rotate ×1' },
  { shape: [[1, 0, 0], [1, 1, 1]], unit: 'lancer', reward: 'move', rewardLabel: 'Move ×1' },
  { shape: [[0, 0, 1], [1, 1, 1]], unit: 'monk', reward: 'rotate', rewardLabel: 'Rotate ×1' },
  { shape: [[1, 1, 0], [0, 1, 1]], unit: 'pawn_hammer', reward: 'time', rewardLabel: '+15s' },
  { shape: [[0, 1, 1], [1, 1, 0]], unit: 'pawn_axe', reward: 'time', rewardLabel: '+15s' },
  { shape: [[1, 1], [1, 1]], unit: null, reward: 'move', rewardLabel: 'Move ×1' },
  { shape: [[0, 1, 0], [1, 1, 1]], unit: null, reward: 'rotate', rewardLabel: 'Rotate ×1' },
];

function trimShape(shape) {
  let s = shape.map(row => [...row]);
  while (s.length > 0 && s[0].every(v => !v)) s.shift();
  while (s.length > 0 && s[s.length - 1].every(v => !v)) s.pop();
  if (!s.length) return [[0]];

  while (s[0].length > 0 && s.every(row => !row[0])) {
    for (const row of s) row.shift();
  }
  while (s[0].length > 0 && s.every(row => !row[row.length - 1])) {
    for (const row of s) row.pop();
  }
  return s;
}

function rotateShape(shape) {
  const trimmed = trimShape(shape);
  const rows = trimmed.length;
  const cols = trimmed[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = trimmed[r][c];
    }
  }
  return trimShape(rotated);
}

function shapeKey(shape) {
  return JSON.stringify(trimShape(shape));
}

function shapesMatch(a, b) {
  let current = trimShape(a);
  const target = shapeKey(b);
  for (let i = 0; i < 4; i++) {
    if (shapeKey(current) === target) return true;
    current = rotateShape(current);
  }
  return false;
}

function formationMatchesTask(formation, task) {
  if (task.unit && formation.unit !== task.unit) return false;
  return shapesMatch(formation.shape, task.shape);
}

class TaskManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.activeTasks = [];
    this.rewards = { move: 0, rotate: 0 };
    this.nextId = 0;
    this.onComplete = null;
  }

  reset() {
    this.activeTasks = [];
    this.rewards = { move: 0, rotate: 0 };
    this.nextId = 0;
    this.render();
  }

  fillTasks(count = 2) {
    while (this.activeTasks.length < count) {
      this.addRandomTask();
    }
    this.render();
  }

  addRandomTask() {
    const available = TASK_POOL.filter(task =>
      !this.activeTasks.some(active =>
        shapeKey(active.shape) === shapeKey(task.shape) &&
        active.unit === task.unit &&
        active.reward === task.reward
      )
    );
    const pool = available.length ? available : TASK_POOL;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.activeTasks.push({
      id: this.nextId++,
      ...pick,
      shape: pick.shape.map(row => [...row]),
    });
  }

  checkFormation(formation) {
    const completed = [];
    for (const task of this.activeTasks) {
      if (formationMatchesTask(formation, task)) {
        completed.push(task);
      }
    }

    for (const task of completed) {
      this.completeTask(task);
    }
    return completed;
  }

  completeTask(task) {
    this.activeTasks = this.activeTasks.filter(t => t.id !== task.id);
    this.grantReward(task);
    this.addRandomTask();
    this.render();
    if (this.onComplete) this.onComplete(task);
  }

  grantReward(task) {
    switch (task.reward) {
      case 'move':
        this.rewards.move++;
        break;
      case 'rotate':
        this.rewards.rotate++;
        break;
      case 'time':
        if (this.onTimeReward) this.onTimeReward(15);
        break;
    }
  }

  useMove(game, dir) {
    if (this.rewards.move <= 0) return false;
    if (!game.currentFormation || game.isProcessing || game.isPaused) return false;

    const newCol = game.currentCol + dir;
    if (canPlace(game.board, game.currentFormation, game.currentRow, newCol, game.terrainMap)) {
      game.currentCol = newCol;
      this.rewards.move--;
      audio.playMove();
      this.render();
      return true;
    }
    return false;
  }

  useRotate(game) {
    if (this.rewards.rotate <= 0) return false;
    if (!game.currentFormation || game.isProcessing || game.isPaused) return false;

    const backup = game.currentFormation.rotation;
    game.currentFormation.rotate();
    if (!canPlace(game.board, game.currentFormation, game.currentRow, game.currentCol, game.terrainMap)) {
      game.currentFormation.rotation = backup;
      return false;
    }

    this.rewards.rotate--;
    audio.playRotate();
    document.getElementById('formation-name').textContent = game.currentFormation.name;
    game.updatePreview();
    this.render();
    return true;
  }

  render() {
    const list = document.getElementById('task-list');
    const rewardBar = document.getElementById('reward-bar');
    const toast = document.getElementById('task-toast');
    if (!list || !rewardBar) return;

    list.innerHTML = '';
    for (const task of this.activeTasks) {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `
        <canvas class="task-canvas"></canvas>
        <span class="task-reward-label">${task.rewardLabel}</span>
      `;
      const canvas = card.querySelector('.task-canvas');
      this.renderer.drawTaskShape(task.shape, task.unit || 'pawn', canvas);
      list.appendChild(card);
    }

    rewardBar.innerHTML = '';
    if (this.rewards.move > 0) {
      const btn = document.createElement('button');
      btn.className = 'reward-btn reward-move';
      btn.textContent = `Move (${this.rewards.move})`;
      btn.title = 'Use move reward on active formation';
      btn.addEventListener('click', () => {
        if (window.game) window.game.useMoveReward(1);
      });
      rewardBar.appendChild(btn);
    }
    if (this.rewards.rotate > 0) {
      const btn = document.createElement('button');
      btn.className = 'reward-btn reward-rotate';
      btn.textContent = `Rotate (${this.rewards.rotate})`;
      btn.title = 'Use rotate reward on active formation';
      btn.addEventListener('click', () => {
        if (window.game) window.game.useRotateReward();
      });
      rewardBar.appendChild(btn);
    }

    if (toast && !this.rewards.move && !this.rewards.rotate) {
      toast.classList.add('hidden');
    }
  }

  showToast(message) {
    const toast = document.getElementById('task-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
  }
}
