const UNIFIED_ROW_TIME_BONUS = 5;
const MORALE_TIME_MULTIPLIER = 3;
const MORALE_MIN_STREAK_FOR_TIME = 2;
const MORALE_MIN_STREAK_FOR_KEYS = 3;
const MORALE_BONUS_KEYS = 3;
const COINS_PER_LINE = 1;
const MAX_COIN_GRANT = 9;
const SKILL_COST = 10;
const BLACKSMITH_PLACEMENTS = 3;

class FormationGeneral {
  constructor() {
    this.save = loadSave();
    migrateClearCountFromSave(this.save);
    this.loadout = loadLoadout();
    this.state = 'menu';
    this.currentLevel = 1;
    this.board = createEmptyBoard();
    this.currentFormation = null;
    this.currentRow = 0;
    this.currentCol = 3;
    this.linesCleared = 0;
    this.timeRemaining = 0;
    this.dropTimer = 0;
    this.dropInterval = 800;
    this.isProcessing = false;
    this.isPaused = false;
    this.lastTime = 0;
    this.softDropping = false;
    this.inputCountThisFall = 0;
    this.maxInputsPerFall = 8;
    this.inputLimitThisFall = 8;
    this.nextFormation = null;
    this.moraleStreak = 0;
    this.bonusInputsNextFall = 0;
    this.coins = 0;
    this.wood = 0;
    this.selectedCharacter = null;
    this.characterUsed = false;
    this.blacksmithMode = false;
    this.blacksmithRemaining = 0;
    this.blacksmithTarget = 0;
    this.blacksmithHover = null;
    this.dropSlowUntil = 0;
    this.dropSlowMultiplier = 1;
    this.supplyBonusClearsRemaining = 0;
    this.supplyBonusPerClear = 0;
    this.buildings = createEmptyBuildings();
    this.buildingPlacement = null;
    this.buildingHover = null;
    this.buildingProductionTimers = {};
    this.terrainMap = null;
    this.clearPollTimer = null;

    this.canvas = document.getElementById('game-canvas');
    this.previewCanvas = document.getElementById('preview-canvas');
    this.renderer = new Renderer(this.canvas);
    this.cityPanel = new CityPanel(
      document.getElementById('city-panel-canvas'),
      ({ coins, wood }) => this.addCityProduction(coins, wood)
    );
    this.taskManager = new TaskManager(this.renderer);
    this.taskManager.onComplete = (task) => this.onTaskComplete(task);
    this.taskManager.onTimeReward = (seconds) => {
      this.timeRemaining += seconds;
      this.updateTimerDisplay();
    };

    this.bindUI();
    this.bindInput();
    this.updateMenuDisplay();
    this.refreshTotalClears();
    this.startClearPolling();

    const menuScreen = document.getElementById('menu-screen');
    if (menuScreen) {
      menuScreen.addEventListener('click', () => audio.init(), { once: true });
    }

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.cityPanel.resize(this.renderer.cellSize);
      if (this.state === 'playing') this.render();
    });

    Promise.all([
      this.renderer.loadSprites(),
      this.cityPanel.load(),
    ]).then(() => {
      this.cityPanel.resize(this.renderer.cellSize);
      this.taskManager.render();
      requestAnimationFrame(this.loop.bind(this));
    });
  }

  bindUI() {
    document.getElementById('btn-back').addEventListener('click', () => this.goToMenu());
    document.getElementById('btn-start-tutorial').addEventListener('click', () => this.startGameplay());
    document.getElementById('btn-dismiss-terrain-rules').addEventListener('click', () => this.dismissTerrainRules());
    document.getElementById('btn-next-level').addEventListener('click', () => this.nextLevel());
    document.getElementById('btn-retry').addEventListener('click', () => this.retryLevel());
    document.getElementById('btn-to-menu-win').addEventListener('click', () => this.goToMenu());
    document.getElementById('btn-to-menu-lose').addEventListener('click', () => this.goToMenu());
    document.getElementById('btn-dispatch').addEventListener('click', () => this.showDispatchHall());
    document.getElementById('btn-close-dispatch').addEventListener('click', () => this.hideDispatchHall());
    document.getElementById('btn-use-ability').addEventListener('click', () => this.useCharacterAbility());
    const touchAbility = document.getElementById('btn-use-ability-touch');
    if (touchAbility) touchAbility.addEventListener('click', () => this.useCharacterAbility());
    this.bindTouchControls();
    this.bindCanvasInput();
    this.buildCharacterSelect();
    this.buildShop();
    this.buildDispatchHall();
  }

  bindCanvasInput() {
    const updateHover = (e) => {
      if (this.blacksmithMode) {
        this.blacksmithHover = this.getCanvasCell(e.clientX, e.clientY);
        this.buildingHover = null;
        return;
      }
      if (this.buildingPlacement) {
        this.buildingHover = this.getCanvasCell(e.clientX, e.clientY);
        this.blacksmithHover = null;
        return;
      }
      this.blacksmithHover = null;
      this.buildingHover = null;
    };

    this.canvas.addEventListener('click', (e) => {
      audio.init();
      const cell = this.getCanvasCell(e.clientX, e.clientY);
      if (!cell) return;
      if (this.blacksmithMode) {
        this.handleBlacksmithPlacement(cell.row, cell.col);
      } else if (this.buildingPlacement) {
        this.handleBuildingPlacement(cell.row, cell.col);
      }
    });
    this.canvas.addEventListener('mousemove', updateHover);
    this.canvas.addEventListener('mouseleave', () => {
      this.blacksmithHover = null;
      this.buildingHover = null;
    });
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (!this.blacksmithMode && !this.buildingPlacement) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        updateHover(touch);
      },
      { passive: true }
    );
    this.canvas.addEventListener('touchend', (e) => {
      if (!this.blacksmithMode && !this.buildingPlacement) return;
      e.preventDefault();
      audio.init();
      const touch = e.changedTouches[0];
      if (!touch) return;
      const cell = this.getCanvasCell(touch.clientX, touch.clientY);
      if (!cell) return;
      if (this.blacksmithMode) {
        this.handleBlacksmithPlacement(cell.row, cell.col);
      } else if (this.buildingPlacement) {
        this.handleBuildingPlacement(cell.row, cell.col);
      }
    });
  }

  getCanvasCell(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const col = Math.floor(x / this.renderer.cellSize);
    const row = Math.floor(y / this.renderer.cellSize);

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return { row, col };
  }

  bindTouchControls() {
    const panel = document.getElementById('touch-controls');
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (this.state !== 'playing' || this.isProcessing || this.isPaused) return;
      audio.init();
      switch (btn.dataset.action) {
        case 'left': this.moveHorizontal(-1); break;
        case 'right': this.moveHorizontal(1); break;
        case 'rotate': this.rotateFormation(); break;
        case 'drop': this.hardDrop(); break;
      }
    });
  }

  bindInput() {
    document.addEventListener('keydown', (e) => {
      if (this.state !== 'playing' || this.isProcessing || this.isPaused) return;

      audio.init();

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.moveHorizontal(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.moveHorizontal(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.rotateFormation();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.softDropping = true;
          break;
        case ' ':
          e.preventDefault();
          this.hardDrop();
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          this.useMoveReward(-1);
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          this.useMoveReward(1);
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          this.useRotateReward();
          break;
        case 'q':
        case 'Q':
          e.preventDefault();
          this.useCharacterAbility();
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowDown') this.softDropping = false;
    });
  }

  buildLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    const totalClears = loadTotalClears();
    LEVELS.forEach(level => {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      const linesRequired = getEffectiveLinesRequired(level, totalClears);
      btn.innerHTML = `${level.id}<span class="level-req">${linesRequired} lines</span>`;

      if (level.id > this.save.unlockedLevel) {
        btn.classList.add('locked');
      }
      if (this.save.completedLevels.includes(level.id)) {
        btn.classList.add('completed');
      }

      btn.addEventListener('click', () => {
        if (level.id <= this.save.unlockedLevel) {
          audio.init();
          this.startLevel(level.id);
        }
      });

      grid.appendChild(btn);
    });
  }

  updateMenuDisplay() {
    const clears = loadTotalClears();
    document.getElementById('clear-count-display').textContent =
      formatDifficultyDisplay(clears);
    this.updateDispatchButton(clears);
    this.buildLevelGrid();
  }

  updateDispatchButton(totalClears) {
    const btn = document.getElementById('btn-dispatch');
    if (!btn) return;
    const hasUnlockable = CHARACTERS.some(
      c => c.tier === 'elite' &&
        isCharacterUnlocked(c, totalClears) &&
        this.loadout[c.slot] !== c.id
    );
    btn.classList.toggle('has-unlock', hasUnlockable);
  }

  getRosterCharacters() {
    return getActiveRoster(this.loadout, loadTotalClears());
  }

  async refreshTotalClears() {
    await fetchTotalClears();
    this.updateMenuDisplay();
  }

  startClearPolling() {
    if (this.clearPollTimer) clearInterval(this.clearPollTimer);
    this.clearPollTimer = setInterval(() => {
      if (this.state === 'menu') this.refreshTotalClears();
    }, 3000);
  }

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${name}-screen`).classList.add('active');
  }

  goToMenu() {
    this.state = 'menu';
    audio.stopTerrainAmbience();
    this.cityPanel.stop();
    this.selectedCharacter = null;
    this.characterUsed = false;
    this.exitBlacksmithMode();
    this.exitBuildingPlacement();
    this.hideModals();
    this.updateCharacterAbilityUI();
    this.showScreen('menu');
    this.updateMenuDisplay();
    this.buildCharacterSelect();
    this.buildShop();
    this.refreshTotalClears();
    this.buildDispatchHall();
  }

  hideModals() {
    document.getElementById('victory-modal').classList.add('hidden');
    document.getElementById('defeat-modal').classList.add('hidden');
    this.hideDispatchHall();
    this.closeRulesScroll('tutorial-overlay', { immediate: true });
    this.closeRulesScroll('terrain-rules-overlay', { immediate: true });
    document.getElementById('march-overlay').classList.add('hidden');
    document.getElementById('character-overlay').classList.add('hidden');
  }

  fitRulesScrollLayout(overlay) {
    const scroll = overlay.querySelector('.scroll-unfurl');
    const body = overlay.querySelector('.scroll-body');
    const content = overlay.querySelector('.scroll-content');
    if (!scroll || !body || !content) return;

    scroll.classList.remove('is-open', 'is-closing');
    body.style.maxHeight = 'none';
    body.style.clipPath = 'none';
    const naturalHeight = content.offsetHeight;
    body.style.maxHeight = '';
    body.style.clipPath = '';

    const rodHeight = 36;
    const padding = 24;
    const maxAvailable = Math.max(120, overlay.clientHeight - rodHeight - padding);
    const openHeight = Math.min(naturalHeight, maxAvailable);
    scroll.style.setProperty('--scroll-open-height', `${openHeight}px`);
  }

  openRulesScroll(overlayId) {
    ['tutorial-overlay', 'terrain-rules-overlay'].forEach((id) => {
      if (id !== overlayId) this.closeRulesScroll(id, { immediate: true });
    });

    const overlay = document.getElementById(overlayId);
    if (!overlay) return;

    const scroll = overlay.querySelector('.scroll-unfurl');
    const content = overlay.querySelector('.scroll-content');
    scroll?.classList.remove('is-open', 'is-closing');
    if (content) content.scrollTop = 0;
    overlay.classList.remove('hidden');
    overlay.offsetHeight;
    this.fitRulesScrollLayout(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scroll?.classList.add('is-open'));
    });
  }

  closeRulesScroll(overlayId, { immediate = false } = {}) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;

    const scroll = overlay.querySelector('.scroll-unfurl');
    if (immediate) {
      scroll?.classList.remove('is-open', 'is-closing');
      overlay.classList.add('hidden');
      return;
    }

    if (!scroll || overlay.classList.contains('hidden')) return;

    scroll.classList.remove('is-open');
    scroll.classList.add('is-closing');
    setTimeout(() => {
      scroll.classList.remove('is-closing');
      overlay.classList.add('hidden');
    }, 780);
  }

  dismissTerrainRules() {
    this.closeRulesScroll('terrain-rules-overlay');
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  buildCharacterSelect() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;
    grid.innerHTML = '';
    this.getRosterCharacters().forEach(char => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'character-card' +
        (char.tier === 'elite' ? ' elite' : '') +
        (char.tier === 'legendary' ? ' legendary' : '');
      card.innerHTML = `
        ${char.tier === 'elite' ? '<span class="elite-badge">ELITE</span>' : ''}
        <img class="character-icon" src="${char.icon}" alt="${char.name}">
        <span class="character-name">${char.name}</span>
        <span class="character-title">${char.title}</span>
        <p class="character-desc">${char.desc}</p>
        <span class="character-effect">${char.effectLabel}</span>
      `;
      card.addEventListener('click', () => {
        audio.init();
        this.selectCharacter(char.id);
      });
      grid.appendChild(card);
    });
  }

  buildDispatchHall() {
    const container = document.getElementById('dispatch-slots');
    if (!container) return;

    const totalClears = loadTotalClears();
    container.innerHTML = '';

    const slotLabels = {
      breaker: 'Breaker · Frontline',
      chrono: 'Chrono · Time',
      forge: 'Forge · Support',
      tactician: 'Tactics · Command',
      rally: 'Rally · Supply',
    };

    CHARACTER_SLOTS.forEach(slot => {
      const slotEl = document.createElement('div');
      slotEl.className = 'dispatch-slot';
      slotEl.innerHTML = `<span class="dispatch-slot-label">${slotLabels[slot] || slot}</span>`;

      const optionsEl = document.createElement('div');
      optionsEl.className = 'dispatch-options';

      getCharactersForSlot(slot).forEach(char => {
        const unlocked = isCharacterUnlocked(char, totalClears);
        const equipped = this.loadout[slot] === char.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dispatch-option';
        if (char.tier === 'elite') btn.classList.add('elite');
        if (char.tier === 'legendary') btn.classList.add('legendary');
        if (equipped) btn.classList.add('equipped');
        if (!unlocked) btn.classList.add('locked');

        let badge = '';
        if (equipped) {
          badge = '<span class="dispatch-option-badge equipped">Equipped</span>';
        } else if (!unlocked) {
          badge = `<span class="dispatch-option-badge locked">Requires ${char.unlockClears} clears</span>`;
        } else if (char.tier === 'elite') {
          badge = '<span class="dispatch-option-badge elite-tag">Elite</span>';
        } else if (char.tier === 'legendary') {
          badge = '<span class="dispatch-option-badge legendary-tag">Legendary</span>';
        }

        btn.innerHTML = `
          <img class="dispatch-option-icon" src="${char.icon}" alt="${char.name}">
          <span class="dispatch-option-name">${char.name}</span>
          <span class="dispatch-option-effect">${char.effectLabel}</span>
          ${badge}
        `;

        if (unlocked && !equipped) {
          btn.addEventListener('click', () => {
            audio.init();
            this.equipCharacter(slot, char.id);
          });
        }

        optionsEl.appendChild(btn);
      });

      slotEl.appendChild(optionsEl);
      container.appendChild(slotEl);
    });

    const clearsEl = document.getElementById('dispatch-clears-display');
    if (clearsEl) clearsEl.textContent = `Total clears: ${totalClears}`;
    this.updateDispatchButton(totalClears);
  }

  showDispatchHall() {
    audio.init();
    this.buildDispatchHall();
    document.getElementById('dispatch-modal').classList.remove('hidden');
  }

  hideDispatchHall() {
    document.getElementById('dispatch-modal')?.classList.add('hidden');
  }

  equipCharacter(slot, charId) {
    const char = getCharacter(charId);
    if (!char || char.slot !== slot) return;
    if (!isCharacterUnlocked(char, loadTotalClears())) return;

    this.loadout[slot] = charId;
    saveLoadout(this.loadout);
    this.buildDispatchHall();
    this.buildCharacterSelect();
    this.buildShop();
    audio.playPlace();
  }

  showCharacterSelect() {
    document.getElementById('character-overlay').classList.remove('hidden');
    this.state = 'character-select';
    this.isPaused = true;
  }

  selectCharacter(charId) {
    this.selectedCharacter = getCharacter(charId);
    this.characterUsed = false;
    audio.playCharacterSound(charId);
    document.getElementById('character-overlay').classList.add('hidden');
    this.beginLevel();
  }

  updateCharacterAbilityUI() {
    const panel = document.getElementById('character-ability-panel');
    const card = panel?.querySelector('.character-ability-card');
    const btn = document.getElementById('btn-use-ability');
    const touchBtn = document.getElementById('btn-use-ability-touch');
    if (!panel || !this.selectedCharacter) {
      panel?.classList.add('hidden');
      if (touchBtn) touchBtn.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    const iconEl = document.getElementById('character-ability-icon');
    iconEl.innerHTML = `<img src="${this.selectedCharacter.icon}" alt="${this.selectedCharacter.name}">`;
    document.getElementById('character-ability-name').textContent = this.selectedCharacter.name;
    document.getElementById('character-ability-effect').textContent =
      this.characterUsed ? 'Skill used' : this.selectedCharacter.effectLabel;

    card?.classList.toggle('ready', !this.characterUsed);
    card?.classList.toggle('used', this.characterUsed);
    if (btn) {
      btn.disabled = this.characterUsed || this.isPaused || this.isProcessing;
      btn.textContent = this.characterUsed ? 'Used' : 'Deploy';
    }
    if (touchBtn) {
      touchBtn.classList.remove('hidden');
      touchBtn.disabled = this.characterUsed || this.isPaused || this.isProcessing;
      if (this.characterUsed) {
        touchBtn.textContent = '✓';
      } else {
        touchBtn.innerHTML = `<img src="${this.selectedCharacter.icon}" alt="${this.selectedCharacter.name}">`;
      }
    }
  }

  useCharacterAbility() {
    if (this.state !== 'playing' || this.isPaused || this.isProcessing) return;
    if (!this.selectedCharacter || this.characterUsed) return;

    this.characterUsed = true;
    this.updateCharacterAbilityUI();

    const card = document.querySelector('.character-ability-card');
    if (card) {
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 600);
    }

    this.executeSkill(this.selectedCharacter.id);
  }

  buildShop() {
    const list = document.getElementById('shop-list');
    if (!list) return;
    list.innerHTML = '';

    const skillsSection = document.createElement('div');
    skillsSection.className = 'shop-category';
    skillsSection.innerHTML = '<span class="shop-category-label">Skills</span>';
    const skillsList = document.createElement('div');
    skillsList.className = 'shop-category-list';
    this.getRosterCharacters().forEach(char => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-item';
      btn.dataset.shopType = 'skill';
      btn.dataset.charId = char.id;
      btn.innerHTML = `
        <img class="shop-item-icon" src="${char.icon}" alt="${char.name}">
        <span class="shop-item-info">
          <span class="shop-item-name">${char.name}${char.tier === 'elite' ? ' ★' : ''}${char.tier === 'legendary' ? ' ★★' : ''}</span>
          <span class="shop-item-cost"><img src="assets/coins.gif" alt=""> ${SKILL_COST}</span>
        </span>
      `;
      btn.addEventListener('click', () => {
        audio.init();
        this.buySkill(char.id);
      });
      skillsList.appendChild(btn);
    });
    skillsSection.appendChild(skillsList);
    list.appendChild(skillsSection);

    const buildingsSection = document.createElement('div');
    buildingsSection.className = 'shop-category';
    buildingsSection.innerHTML = '<span class="shop-category-label">Buildings</span>';
    const buildingsList = document.createElement('div');
    buildingsList.className = 'shop-category-list';
    BUILDINGS.forEach(building => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-item';
      btn.dataset.shopType = 'building';
      btn.dataset.buildingId = building.id;
      btn.innerHTML = `
        <img class="shop-item-icon" src="${building.icon}" alt="${building.name}">
        <span class="shop-item-info">
          <span class="shop-item-name">${building.name}</span>
          <span class="shop-item-cost">${formatBuildingCost(building)}</span>
        </span>
      `;
      btn.addEventListener('click', () => {
        audio.init();
        this.buyBuilding(building.id);
      });
      buildingsList.appendChild(btn);
    });
    buildingsSection.appendChild(buildingsList);
    list.appendChild(buildingsSection);
  }

  updateShopUI() {
    document.querySelectorAll('.shop-item').forEach(btn => {
      if (btn.dataset.shopType === 'building') {
        const building = getBuilding(btn.dataset.buildingId);
        btn.disabled = !building ||
          !canAffordBuilding(this.coins, this.wood, building) ||
          this.state !== 'playing' ||
          this.isPaused ||
          this.isProcessing;
        return;
      }

      btn.disabled = this.coins < SKILL_COST ||
        this.state !== 'playing' ||
        this.isPaused ||
        this.isProcessing;
    });
  }

  updateResourcesDisplay() {
    const coinsEl = document.getElementById('coins-display');
    const woodEl = document.getElementById('wood-display');
    if (coinsEl) coinsEl.textContent = String(this.coins);
    if (woodEl) woodEl.textContent = String(this.wood);
    this.updateShopUI();
  }

  updateCoinsDisplay() {
    this.updateResourcesDisplay();
  }

  addCoins(amount) {
    if (amount <= 0) return;
    let remaining = amount;
    while (remaining > 0) {
      const grant = Math.min(remaining, MAX_COIN_GRANT);
      this.coins += grant;
      remaining -= grant;
      audio.playCoin();
      this.playResourceEffect({ coins: grant });
    }
    this.updateResourcesDisplay();
  }

  addWood(amount) {
    if (amount <= 0) return;
    this.wood += amount;
    this.updateResourcesDisplay();
    this.playResourceEffect({ wood: amount });
  }

  addCityProduction(coins, wood) {
    if (coins > 0) this.addCoins(coins);
    if (wood > 0) this.addWood(wood);
  }

  playResourceEffect({ coins = 0, wood = 0 }) {
    const layer = document.getElementById('coin-effect-layer');
    const resourcesPanel = document.getElementById('resources-panel');
    const canvas = this.canvas;
    if (!layer || !canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const areaRect = layer.parentElement.getBoundingClientRect();
    const float = document.createElement('div');
    float.className = 'coin-float';
    const parts = [];
    if (coins > 0) parts.push(`<img src="assets/coins.gif" alt=""><span>+${coins}</span>`);
    if (wood > 0) parts.push(`<img src="assets/wood.png" alt=""><span>+${wood}</span>`);
    float.innerHTML = parts.join('');
    float.style.left = `${canvasRect.left + canvasRect.width / 2 - areaRect.left}px`;
    float.style.top = `${canvasRect.top + canvasRect.height / 2 - areaRect.top}px`;
    layer.appendChild(float);
    setTimeout(() => float.remove(), 900);

    if (resourcesPanel) {
      resourcesPanel.classList.remove('coin-pop');
      void resourcesPanel.offsetWidth;
      resourcesPanel.classList.add('coin-pop');
    }
  }

  playCoinEffect(amount) {
    this.playResourceEffect({ coins: amount });
  }

  buySkill(charId) {
    if (this.state !== 'playing' || this.isPaused || this.isProcessing) return;
    if (this.coins < SKILL_COST) {
      this.taskManager.showToast('Not enough coins!');
      return;
    }
    this.coins -= SKILL_COST;
    this.updateCoinsDisplay();
    audio.playCoin();
    this.executeSkill(charId);
  }

  buyBuilding(buildingId) {
    if (this.state !== 'playing' || this.isPaused || this.isProcessing) return;

    const building = getBuilding(buildingId);
    if (!building) return;

    if (!canAffordBuilding(this.coins, this.wood, building)) {
      this.taskManager.showToast('Not enough resources!');
      return;
    }

    const placeable = countBuildingPlaceableCells(this.board, this.buildings, this.terrainMap);
    if (placeable <= 0) {
      this.taskManager.showToast(`${building.name}: no empty cells to build!`);
      return;
    }

    this.coins -= building.costCoins;
    this.wood -= building.costWood;
    this.updateResourcesDisplay();
    if (building.costCoins > 0) audio.playCoin();
    this.startBuildingPlacement(buildingId);
  }

  startBuildingPlacement(buildingId) {
    const building = getBuilding(buildingId);
    if (!building) return;

    this.buildingPlacement = buildingId;
    this.buildingHover = null;
    this.isProcessing = true;
    this.canvas.classList.add('forge-mode');
    this.updateCharacterAbilityUI();
    this.updateShopUI();
    this.taskManager.showToast(`${building.name}: click an empty cell to build`);
  }

  handleBuildingPlacement(row, col) {
    if (!this.buildingPlacement) return;
    if (!canPlaceBuilding(this.board, this.buildings, this.terrainMap, row, col)) return;

    const buildingId = this.buildingPlacement;
    const building = getBuilding(buildingId);
    this.buildings = placeBuildingOnGrid(this.buildings, row, col, buildingId);
    if (building?.productionInterval) {
      this.buildingProductionTimers[`${row},${col}`] = 0;
    }
    audio.playPlace();
    this.finishBuildingPlacement(building);
  }

  finishBuildingPlacement(building) {
    this.exitBuildingPlacement();
    const message = `${building.name} built!`;

    const fullRows = findFullRowsWithBuildings(this.board, this.buildings, this.terrainMap);
    if (fullRows.length > 0) {
      this.isProcessing = true;
      this.clearLines(fullRows);
      this.taskManager.showToast(message);
      return;
    }

    this.isProcessing = false;
    this.taskManager.showToast(message);
    this.updateCharacterAbilityUI();
    this.updateShopUI();

    if (!canPlaceAny(this.board, this.terrainMap) && this.state === 'playing') {
      this.gameOver('space');
    }
  }

  exitBuildingPlacement() {
    this.buildingPlacement = null;
    this.buildingHover = null;
    if (!this.blacksmithMode) {
      this.canvas.classList.remove('forge-mode');
    }
  }

  updateBuildingProduction(dt) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const buildingId = this.buildings[r][c];
        if (!buildingId) continue;

        const building = getBuilding(buildingId);
        if (!building?.productionInterval || !building.production) continue;

        const key = `${r},${c}`;
        const elapsed = (this.buildingProductionTimers[key] || 0) + dt;
        const cycles = Math.floor(elapsed / building.productionInterval);
        if (cycles <= 0) {
          this.buildingProductionTimers[key] = elapsed;
          continue;
        }

        this.buildingProductionTimers[key] = elapsed % building.productionInterval;
        const { coins = 0, wood = 0 } = building.production;
        if (coins > 0) this.addCoins(coins * cycles);
        if (wood > 0) this.addWood(wood * cycles);
      }
    }
  }

  remapBuildingProductionTimers(oldBuildings, oldTimers) {
    const newTimers = {};
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = this.buildings[r][c];
        if (!id) continue;

        let timer = 0;
        for (let or = 0; or < ROWS; or++) {
          if (oldBuildings[or][c] === id) {
            timer = Math.max(timer, oldTimers[`${or},${c}`] || 0);
          }
        }
        newTimers[`${r},${c}`] = timer;
      }
    }
    this.buildingProductionTimers = newTimers;
  }

  executeSkill(charId) {
    if (this.state !== 'playing' || this.isPaused || this.isProcessing) return;

    audio.init();
    const params = getSkillParams(charId);
    if (!params) return;

    audio.playCharacterSound(charId);
    const char = getCharacter(charId);

    switch (params.type) {
      case 'clearBottom': {
        this.board = clearBottomRows(this.board, params.rows);
        if (params.timeBonus > 0) {
          this.timeRemaining += params.timeBonus;
          this.updateTimerDisplay();
        }
        if (params.coins > 0) {
          this.addCoins(params.coins);
        }
        if (params.wood > 0) {
          this.addWood(params.wood);
        }
        const timePart = params.timeBonus > 0 ? ` +${params.timeBonus}s` : '';
        const coinPart = params.coins > 0 ? ` +${params.coins} coins` : '';
        const woodPart = params.wood > 0 ? ` +${params.wood} wood` : '';
        this.taskManager.showToast(`${char.name}! Cleared ${params.rows} bottom rows${timePart}${coinPart}${woodPart}!`);
        break;
      }
      case 'addTime': {
        this.timeRemaining += params.seconds;
        this.updateTimerDisplay();
        this.taskManager.showToast(`${char.name}! +${params.seconds} seconds!`);
        break;
      }
      case 'slowTime': {
        this.timeRemaining += params.seconds;
        this.dropSlowUntil = performance.now() + params.slowDuration * 1000;
        this.dropSlowMultiplier = params.slowMultiplier || 2;
        this.updateTimerDisplay();
        this.taskManager.showToast(
          `${char.name}! +${params.seconds}s · Fall speed halved for ${params.slowDuration}s!`
        );
        break;
      }
      case 'place':
        this.startBlacksmithPlacement(params.count);
        return;
      case 'fillBottomGaps': {
        const result = fillLowestRowGaps(this.board, this.terrainMap);
        this.board = result.board;
        if (params.timeBonus > 0) {
          this.timeRemaining += params.timeBonus;
          this.updateTimerDisplay();
        }
        const timePart = params.timeBonus > 0 ? ` +${params.timeBonus}s` : '';
        this.taskManager.showToast(
          `${char.name}! Sealed ${result.filled} gap${result.filled !== 1 ? 's' : ''}${timePart}!`
        );

        const fullRows = findFullRowsWithBuildings(this.board, this.buildings, this.terrainMap);
        if (fullRows.length > 0) {
          this.isProcessing = true;
          this.clearLines(fullRows);
          return;
        }
        break;
      }
      case 'addKeys': {
        this.bonusInputsNextFall += params.keys;
        if (params.timeBonus > 0) {
          this.timeRemaining += params.timeBonus;
          this.updateTimerDisplay();
        }
        const timePart = params.timeBonus > 0 ? ` · +${params.timeBonus}s` : '';
        this.taskManager.showToast(`${char.name}! +${params.keys} keys on next piece${timePart}!`);
        break;
      }
      case 'rerollPiece': {
        this.rerollCurrentFormation();
        if (params.keys > 0) {
          this.bonusInputsNextFall += params.keys;
        }
        this.taskManager.showToast(
          `${char.name}! Formation rerolled · +${params.keys} keys on next piece!`
        );
        break;
      }
      case 'addResources': {
        if (params.coins > 0) this.addCoins(params.coins);
        if (params.wood > 0) this.addWood(params.wood);
        const parts = [];
        if (params.coins > 0) parts.push(`+${params.coins} coins`);
        if (params.wood > 0) parts.push(`+${params.wood} wood`);
        this.taskManager.showToast(`${char.name}! ${parts.join(' · ')}!`);
        break;
      }
      case 'supplyContract': {
        if (params.upfrontWood > 0) this.addWood(params.upfrontWood);
        this.supplyBonusClearsRemaining = params.bonusClears;
        this.supplyBonusPerClear = params.bonusWoodPerClear;
        this.taskManager.showToast(
          `${char.name}! +${params.upfrontWood} wood · +${params.bonusWoodPerClear}/clear for ${params.bonusClears} clears!`
        );
        break;
      }
      case 'rallyMorale': {
        this.moraleStreak = params.morale;
        if (params.timeBonus > 0) {
          this.timeRemaining += params.timeBonus;
          this.updateTimerDisplay();
        }
        this.updateMoraleDisplay();
        this.flashRuleCard('rule-morale');
        this.taskManager.showToast(
          `${char.name}! Morale ×${params.morale} · +${params.timeBonus}s!`
        );
        break;
      }
      default:
        return;
    }

    if (!this.isProcessing && !canPlaceAny(this.board, this.terrainMap) && this.state === 'playing') {
      this.gameOver('space');
    }
  }

  rerollCurrentFormation() {
    if (!this.currentFormation) return;

    this.currentFormation = randomFormation();
    this.currentRow = -this.currentFormation.shape.length;
    this.currentCol = Math.floor(COLS / 2) - 1;
    document.getElementById('formation-name').textContent = this.currentFormation.name;
    this.updatePreview();

    if (!canPlace(this.board, this.currentFormation, this.currentRow, this.currentCol, this.terrainMap)) {
      this.gameOver('overflow');
    }
  }

  startBlacksmithPlacement(count = BLACKSMITH_PLACEMENTS) {
    const emptyCells = countPlaceableCells(this.board, this.terrainMap);
    if (emptyCells <= 0) {
      this.taskManager.showToast('Blacksmith: no empty cells to forge!');
      this.isProcessing = false;
      this.updateCharacterAbilityUI();
      this.updateShopUI();
      return;
    }

    this.blacksmithMode = true;
    this.blacksmithTarget = Math.min(count, emptyCells);
    this.blacksmithRemaining = this.blacksmithTarget;
    this.blacksmithHover = null;
    this.isProcessing = true;
    this.canvas.classList.add('forge-mode');
    this.updateCharacterAbilityUI();
    this.updateShopUI();
    this.taskManager.showToast(
      `Blacksmith: click ${this.blacksmithTarget} empty cell${this.blacksmithTarget !== 1 ? 's' : ''}`
    );
  }

  handleBlacksmithPlacement(row, col) {
    if (!this.blacksmithMode || this.blacksmithRemaining <= 0) return;
    if (this.board[row][col] !== null || isBlockedTerrain(this.terrainMap, row, col)) return;

    this.board = placeCell(this.board, row, col, 'pawn_hammer');
    this.blacksmithRemaining--;
    audio.playPlace();

    if (this.blacksmithRemaining <= 0 || countPlaceableCells(this.board, this.terrainMap) === 0) {
      const placed = this.blacksmithTarget - this.blacksmithRemaining;
      this.finishBlacksmithPlacement(placed);
    }
  }

  finishBlacksmithPlacement(placed) {
    this.exitBlacksmithMode();
    const message = `Blacksmith! Forged ${placed} soldier${placed !== 1 ? 's' : ''}!`;

    const fullRows = findFullRowsWithBuildings(this.board, this.buildings, this.terrainMap);
    if (fullRows.length > 0) {
      this.isProcessing = true;
      this.clearLines(fullRows);
      this.taskManager.showToast(message);
      return;
    }

    this.isProcessing = false;
    this.taskManager.showToast(message);
    this.updateCharacterAbilityUI();
    this.updateShopUI();

    if (!canPlaceAny(this.board, this.terrainMap) && this.state === 'playing') {
      this.gameOver('space');
    }
  }

  exitBlacksmithMode() {
    this.blacksmithMode = false;
    this.blacksmithRemaining = 0;
    this.blacksmithTarget = 0;
    this.blacksmithHover = null;
    if (!this.buildingPlacement) {
      this.canvas.classList.remove('forge-mode');
    }
  }

  beginLevel() {
    audio.init();
    const level = LEVELS[this.currentLevel - 1];

    document.getElementById('level-display').textContent = this.currentLevel;
    document.getElementById('lines-display').textContent =
      `0 / ${this.linesRequired}`;
    const difficultyEl = document.getElementById('difficulty-display');
    const mods = getDifficultyModifiers(loadTotalClears());
    if (mods.tier > 0) {
      difficultyEl.textContent = mods.tierName;
      difficultyEl.classList.remove('hidden');
    } else {
      difficultyEl.textContent = '';
      difficultyEl.classList.add('hidden');
    }
    document.getElementById('formation-name').textContent =
      this.currentFormation.name;
    this.updateMoraleDisplay();
    this.updateTimerDisplay();
    this.updateCoinsDisplay();
    this.updateTerrainHint();
    this.updateShopUI();
    this.updateCharacterAbilityUI();

    const totalClears = loadTotalClears();
    const terrainType = getActiveTerrainType(this.currentLevel, totalClears);
    if (terrainType) {
      audio.startTerrainAmbience(terrainType);
    } else {
      audio.stopTerrainAmbience();
    }

    this.showScreen('game');
    this.state = 'playing';
    this.cityPanel.resize(this.renderer.cellSize);
    this.cityPanel.start();

    if (level.tutorial) {
      document.getElementById('tutorial-goal').textContent = this.linesRequired;
      document.getElementById('tutorial-input-limit').textContent = this.maxInputsPerFall;
      this.openRulesScroll('tutorial-overlay');
      this.isPaused = true;
    } else {
      const terrainInfo = getTerrainHint(this.currentLevel, totalClears);
      if (terrainInfo) {
        document.getElementById('terrain-rules-title').textContent = terrainInfo.label;
        document.getElementById('terrain-rules-desc').textContent = terrainInfo.hint;
        this.openRulesScroll('terrain-rules-overlay');
        this.isPaused = true;
      } else {
        this.hideModals();
        this.isPaused = false;
        this.lastTime = performance.now();
      }
    }
    this.updateCharacterAbilityUI();
  }

  startLevel(levelId, { resetCoins = true } = {}) {
    this.currentLevel = levelId;
    const level = LEVELS[levelId - 1];
    const totalClears = loadTotalClears();
    const mods = getDifficultyModifiers(totalClears);

    this.board = createEmptyBoard();
    this.buildings = createEmptyBuildings();
    this.buildingProductionTimers = {};
    this.terrainMap = createTerrainMap(levelId, totalClears);
    this.linesCleared = 0;
    this.linesRequired = getEffectiveLinesRequired(level, totalClears);
    this.timeRemaining = Math.floor(level.timeLimit * mods.timeMultiplier);
    this.dropInterval = Math.max(300, 900 - levelId * 40 - mods.dropSpeedBonus);
    this.maxInputsPerFall = Math.max(5, 8 - mods.inputPenalty);
    this.dropTimer = 0;
    this.isProcessing = false;
    this.isPaused = false;
    this.softDropping = false;
    this.nextFormation = null;
    this.moraleStreak = 0;
    this.bonusInputsNextFall = 0;
    if (resetCoins) {
      this.coins = 0;
      this.wood = 0;
    }
    this.selectedCharacter = null;
    this.characterUsed = false;
    this.dropSlowUntil = 0;
    this.dropSlowMultiplier = 1;
    this.supplyBonusClearsRemaining = 0;
    this.supplyBonusPerClear = 0;
    this.exitBlacksmithMode();
    this.exitBuildingPlacement();
    this.taskManager.reset();
    this.taskManager.fillTasks(2);
    this.buildCharacterSelect();
    this.buildShop();
    this.spawnFormation();
    this.updateCoinsDisplay();

    this.showScreen('game');
    this.showCharacterSelect();
  }

  startGameplay() {
    audio.init();
    this.closeRulesScroll('tutorial-overlay');
    this.isPaused = false;
    this.updateShopUI();
    this.updateCharacterAbilityUI();
    this.lastTime = performance.now();
  }

  spawnFormation() {
    this.inputCountThisFall = 0;
    this.inputLimitThisFall = this.maxInputsPerFall + this.bonusInputsNextFall;
    this.bonusInputsNextFall = 0;
    this.updateInputDisplay();

    if (this.nextFormation) {
      this.currentFormation = this.nextFormation;
    } else {
      this.currentFormation = randomFormation();
    }
    this.nextFormation = randomFormation();
    this.currentRow = -this.currentFormation.shape.length;
    this.currentCol = Math.floor(COLS / 2) - 1;

    if (!canPlace(this.board, this.currentFormation, this.currentRow, this.currentCol, this.terrainMap)) {
      this.gameOver('overflow');
    }

    this.updatePreview();
  }

  moveHorizontal(dir) {
    if (this.inputCountThisFall >= this.inputLimitThisFall) return;
    this.inputCountThisFall++;
    this.updateInputDisplay();

    const newCol = this.currentCol + dir;
    if (canPlace(this.board, this.currentFormation, this.currentRow, newCol, this.terrainMap)) {
      this.currentCol = newCol;
      audio.playMove();
    }
  }

  rotateFormation() {
    if (this.inputCountThisFall >= this.inputLimitThisFall) return;
    this.inputCountThisFall++;
    this.updateInputDisplay();

    const backup = this.currentFormation.rotation;
    this.currentFormation.rotate();
    if (!canPlace(this.board, this.currentFormation, this.currentRow, this.currentCol, this.terrainMap)) {
      this.currentFormation.rotation = backup;
    } else {
      audio.playRotate();
      document.getElementById('formation-name').textContent =
        this.currentFormation.name;
      this.updatePreview();
    }
  }

  hardDrop() {
    while (canPlace(this.board, this.currentFormation, this.currentRow + 1, this.currentCol, this.terrainMap)) {
      this.currentRow++;
    }
    this.tryLockFormation();
  }

  tryLockFormation() {
    if (hasBlocksAboveBoard(this.currentFormation, this.currentRow)) {
      this.gameOver('overflow');
      return;
    }
    this.lockFormation();
  }

  lockFormation() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.updateShopUI();
    this.updateCharacterAbilityUI();

    this.board = placeFormation(
      this.board, this.currentFormation, this.currentRow, this.currentCol
    );
    this.taskManager.checkFormation(this.currentFormation);
    audio.playPlace();

    const fullRows = findFullRowsWithBuildings(this.board, this.buildings, this.terrainMap);
    if (fullRows.length > 0) {
      this.clearLines(fullRows);
    } else {
      this.moraleStreak = 0;
      this.updateMoraleDisplay();
      this.afterLock();
    }
  }

  getChargeInfo(lineCount) {
    if (lineCount >= 4) return { label: 'Full Assault!', time: 15 };
    if (lineCount === 3) return { label: 'Triple Charge!', time: 10 };
    if (lineCount === 2) return { label: 'Double Charge!', time: 5 };
    return { label: 'March!', time: 0 };
  }

  clearLines(rows) {
    const lineCount = rows.length;
    const charge = this.getChargeInfo(lineCount);
    const unifiedRows = getUnifiedRows(this.board, rows, this.terrainMap);
    const unifiedBonus = unifiedRows.length * UNIFIED_ROW_TIME_BONUS;

    this.moraleStreak++;
    const moraleBonus = this.moraleStreak >= MORALE_MIN_STREAK_FOR_TIME
      ? this.moraleStreak * MORALE_TIME_MULTIPLIER
      : 0;
    const totalTimeBonus = charge.time + unifiedBonus + moraleBonus;

    if (this.moraleStreak >= MORALE_MIN_STREAK_FOR_KEYS) {
      this.bonusInputsNextFall = MORALE_BONUS_KEYS;
    }

    if (totalTimeBonus > 0) {
      this.timeRemaining += totalTimeBonus;
      this.updateTimerDisplay();
    }
    this.updateMoraleDisplay();
    if (this.moraleStreak >= 1) this.flashRuleCard('rule-morale');

    for (const row of rows) {
      this.renderer.addMarchAnimation(row);
    }

    const overlay = document.getElementById('march-overlay');
    const marchText = document.getElementById('march-text');
    const marchSubtext = document.getElementById('march-subtext');
    marchText.textContent = charge.label;
    marchText.classList.toggle('charge-combo', lineCount >= 2);

    const bonusParts = [];
    if (charge.time > 0) bonusParts.push(`+${charge.time}s`);
    if (unifiedBonus > 0) bonusParts.push(`Unified +${unifiedBonus}s`);
    if (moraleBonus > 0) bonusParts.push(`Morale ×${this.moraleStreak} +${moraleBonus}s`);
    if (this.bonusInputsNextFall > 0) bonusParts.push(`+${this.bonusInputsNextFall} keys next`);
    marchSubtext.textContent = bonusParts.join(' · ');
    marchSubtext.classList.toggle('hidden', bonusParts.length === 0);

    overlay.classList.remove('hidden');
    audio.playMarch();

    if (unifiedRows.length > 0) {
      const unit = this.board[unifiedRows[0]][0];
      const unitName = UNIT_NAMES[unit] || 'Troops';
      this.flashRuleCard('rule-unified');
      setTimeout(() => {
        this.taskManager.showToast(`Unified Ranks! All ${unitName}!`);
      }, 400);
    }

    setTimeout(() => {
      overlay.classList.add('hidden');
      marchText.classList.remove('charge-combo');
      this.board = clearRows(this.board, rows);
      const oldBuildings = this.buildings;
      const oldTimers = { ...this.buildingProductionTimers };
      this.buildings = shiftBuildingsAfterClear(this.buildings, rows);
      this.remapBuildingProductionTimers(oldBuildings, oldTimers);
      this.linesCleared += rows.length;
      if (this.supplyBonusClearsRemaining > 0 && this.supplyBonusPerClear > 0) {
        this.addWood(this.supplyBonusPerClear);
        this.supplyBonusClearsRemaining--;
      }
      this.addCoins(rows.length * COINS_PER_LINE);

      const level = LEVELS[this.currentLevel - 1];
      document.getElementById('lines-display').textContent =
        `${this.linesCleared} / ${this.linesRequired}`;

      if (this.linesCleared >= this.linesRequired) {
        this.levelComplete();
        return;
      }

      const cascadeRows = findFullRowsWithBuildings(this.board, this.buildings, this.terrainMap);
      if (cascadeRows.length > 0) {
        this.clearLines(cascadeRows);
        return;
      }

      this.afterLock();
    }, 800);
  }

  afterLock() {
    this.spawnFormation();
    this.isProcessing = false;
    this.updateShopUI();
    this.updateCharacterAbilityUI();
    document.getElementById('formation-name').textContent =
      this.currentFormation.name;

    if (!canPlaceAny(this.board, this.terrainMap)) {
      this.gameOver('space');
    }
  }

  async levelComplete() {
    this.state = 'victory';
    this.isProcessing = false;
    audio.stopTerrainAmbience();
    audio.playVictory();

    const level = LEVELS[this.currentLevel - 1];

    if (!this.save.completedLevels.includes(this.currentLevel)) {
      this.save.completedLevels.push(this.currentLevel);
    }

    if (this.currentLevel >= this.save.unlockedLevel && this.currentLevel < LEVELS.length) {
      this.save.unlockedLevel = this.currentLevel + 1;
    }

    let totalClears = loadTotalClears();
    if (this.currentLevel === LEVELS.length) {
      totalClears = await incrementTotalClears();
      this.save.unlockedLevel = 1;
      this.save.completedLevels = [];
      this.coins = 0;
      this.wood = 0;
      this.updateCoinsDisplay();
    }

    saveProgress(this.save);

    const modal = document.getElementById('victory-modal');
    const msg = document.getElementById('victory-msg');
    const nextBtn = document.getElementById('btn-next-level');

    if (this.currentLevel === LEVELS.length) {
      msg.textContent = `Congratulations, General! You unified the realm! Cleared ${totalClears} times.`;
      this.updateMenuDisplay();
      this.buildDispatchHall();
      nextBtn.style.display = 'none';
    } else {
      msg.textContent = `Level ${this.currentLevel} "${level.name}" complete! Cleared ${this.linesCleared} lines.`;
      nextBtn.style.display = '';
    }

    modal.classList.remove('hidden');
  }

  gameOver(reason) {
    this.state = 'defeat';
    this.isProcessing = false;
    audio.stopTerrainAmbience();
    audio.playDefeat();

    this.save.unlockedLevel = 1;
    this.save.completedLevels = [];
    this.coins = 0;
    this.wood = 0;
    this.updateCoinsDisplay();
    saveProgress(this.save);

    const modal = document.getElementById('defeat-modal');
    const msg = document.getElementById('defeat-msg');

    if (reason === 'time') {
      msg.textContent = 'Time is up. All progress has been reset.';
    } else if (reason === 'overflow') {
      msg.textContent = 'Troops overflowed the battlefield. All progress has been reset.';
    } else {
      msg.textContent = 'No room left to deploy troops. All progress has been reset.';
    }

    modal.classList.remove('hidden');
  }

  nextLevel() {
    this.hideModals();
    if (this.currentLevel < LEVELS.length) {
      this.startLevel(this.currentLevel + 1, { resetCoins: false });
    } else {
      this.goToMenu();
    }
  }

  retryLevel() {
    this.hideModals();
    this.startLevel(1);
  }

  updatePreview() {
    if (this.nextFormation) {
      this.renderer.drawPreview(this.nextFormation, this.previewCanvas);
    }
  }

  updateMoraleDisplay() {
    const el = document.getElementById('morale-display');
    const bonusEl = document.getElementById('morale-bonus');
    if (!el) return;
    if (this.moraleStreak <= 0) {
      el.textContent = '—';
      el.classList.remove('morale-active', 'morale-high');
      if (bonusEl) {
        bonusEl.textContent = '';
        bonusEl.classList.remove('active', 'high');
      }
      this.updateRulesPanel();
      return;
    }
    el.textContent = `×${this.moraleStreak}`;
    el.classList.toggle('morale-active', this.moraleStreak >= 1);
    el.classList.toggle('morale-high', this.moraleStreak >= MORALE_MIN_STREAK_FOR_KEYS);
    if (bonusEl) {
      bonusEl.classList.remove('active', 'high');
      if (this.moraleStreak >= MORALE_MIN_STREAK_FOR_KEYS) {
        const bonus = this.moraleStreak * MORALE_TIME_MULTIPLIER;
        bonusEl.textContent = `+${bonus}s · +${MORALE_BONUS_KEYS} keys`;
        bonusEl.classList.add('high');
      } else if (this.moraleStreak >= MORALE_MIN_STREAK_FOR_TIME) {
        const bonus = this.moraleStreak * MORALE_TIME_MULTIPLIER;
        bonusEl.textContent = `+${bonus}s`;
        bonusEl.classList.add('active');
      } else {
        bonusEl.textContent = 'Chain clears';
        bonusEl.classList.add('active');
      }
    }
    this.updateRulesPanel();
  }

  updateRulesPanel() {
    const moraleCard = document.getElementById('rule-morale');
    const moraleStatus = document.getElementById('morale-rule-status');
    if (!moraleCard || !moraleStatus) return;

    moraleCard.classList.remove('active', 'active-high');
    moraleStatus.classList.remove('active', 'high');

    if (this.moraleStreak <= 0) {
      moraleStatus.textContent = 'Now: —';
      return;
    }

    moraleStatus.textContent = `Now: ×${this.moraleStreak}`;
    if (this.moraleStreak >= MORALE_MIN_STREAK_FOR_KEYS) {
      moraleCard.classList.add('active-high');
      moraleStatus.classList.add('high');
      const bonus = this.moraleStreak * MORALE_TIME_MULTIPLIER;
      moraleStatus.textContent = `Now: ×${this.moraleStreak} (+${bonus}s · +${MORALE_BONUS_KEYS} keys next)`;
    } else if (this.moraleStreak >= 1) {
      moraleCard.classList.add('active');
      moraleStatus.classList.add('active');
      if (this.moraleStreak >= MORALE_MIN_STREAK_FOR_TIME) {
        const bonus = this.moraleStreak * MORALE_TIME_MULTIPLIER;
        moraleStatus.textContent = `Now: ×${this.moraleStreak} (+${bonus}s)`;
      }
    }
  }

  flashRuleCard(id) {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 600);
  }

  onTaskComplete(task) {
    audio.playTaskComplete();
    this.taskManager.showToast(`Order complete! ${task.rewardLabel}`);
  }

  useMoveReward(dir) {
    if (this.state !== 'playing' || this.isPaused) return;
    audio.init();
    this.taskManager.useMove(this, dir);
  }

  useRotateReward() {
    if (this.state !== 'playing' || this.isPaused) return;
    audio.init();
    this.taskManager.useRotate(this);
  }

  updateTimerDisplay() {
    const el = document.getElementById('timer-display');
    el.textContent = formatTime(Math.ceil(this.timeRemaining));
    el.classList.toggle('warning', this.timeRemaining <= 30);
  }

  updateInputDisplay() {
    const el = document.getElementById('input-count-display');
    if (!el) return;
    el.textContent = `${this.inputCountThisFall} / ${this.inputLimitThisFall}`;
    el.classList.toggle('limit-reached', this.inputCountThisFall >= this.inputLimitThisFall);
    el.classList.toggle('keys-low', this.inputCountThisFall >= this.inputLimitThisFall - 2 &&
      this.inputCountThisFall < this.inputLimitThisFall);
  }

  loop(now) {
    const dt = this.lastTime ? now - this.lastTime : 0;
    this.lastTime = now;

    this.renderer.update(dt);

    if (this.state === 'playing' && !this.isPaused && !this.isProcessing) {
      this.cityPanel.update(dt);
      this.updateBuildingProduction(dt);
    }

    if (this.state === 'playing' && !this.isPaused && !this.isProcessing) {
      this.dropTimer += dt;
      const baseInterval = this.softDropping ? this.dropInterval / 8 : this.dropInterval;
      const terrainMult = getTerrainFallMultiplier(
        this.terrainMap,
        this.currentFormation,
        this.currentRow,
        this.currentCol
      );
      audio.updateTerrainAmbienceBoost(isFormationUsingTerrain(
        this.terrainMap,
        this.currentFormation,
        this.currentRow,
        this.currentCol
      ));
      const interval = baseInterval * terrainMult *
        (this.dropSlowUntil > now ? this.dropSlowMultiplier : 1);

      if (this.dropTimer >= interval) {
        this.dropTimer = 0;
        if (canPlace(this.board, this.currentFormation, this.currentRow + 1, this.currentCol, this.terrainMap)) {
          this.currentRow++;
        } else {
          this.tryLockFormation();
        }
      }

      this.timeRemaining -= dt / 1000;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.updateTimerDisplay();
        this.gameOver('time');
      } else {
        this.updateTimerDisplay();
      }
    }

    if (this.state === 'playing' || this.state === 'character-select') {
      let placementState = null;
      if (this.blacksmithMode) {
        placementState = {
          mode: 'blacksmith',
          hover: this.blacksmithHover,
          remaining: this.blacksmithRemaining,
        };
      } else if (this.buildingPlacement) {
        placementState = {
          mode: 'building',
          hover: this.buildingHover,
          buildingId: this.buildingPlacement,
        };
      }

      this.renderer.drawBoard(
        this.board,
        this.blacksmithMode || this.buildingPlacement ? null : this.currentFormation,
        this.currentRow,
        this.currentCol,
        !this.blacksmithMode && !this.buildingPlacement,
        placementState,
        this.terrainMap,
        this.buildings
      );
      this.cityPanel.draw();
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  render() {
    this.renderer.drawBoard(
      this.board,
      this.currentFormation,
      this.currentRow,
      this.currentCol,
      true,
      null,
      this.terrainMap,
      this.buildings
    );
  }

  updateTerrainHint() {
    const el = document.getElementById('terrain-hint');
    if (!el) return;

    const info = getTerrainHint(this.currentLevel, loadTotalClears());
    if (!info) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }

    el.classList.remove('hidden');
    el.textContent = `${info.label}: ${info.hint}`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new FormationGeneral();
});
