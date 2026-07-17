class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.bgmVolume = 0.22;
    this.sfxVolume = 0.9;
    this.bgmDuckedVolume = 0.08;
    this.duckTimer = null;

    this.bgm = this._createAudio('assets/audio/bgm.wav', { loop: true, volume: this.bgmVolume });

    this.terrainAmbience = null;
    this.terrainAmbienceBoosted = false;
    this.terrainBaseVolume = 0.28;
    this.terrainBoostVolume = 0.75;
  }

  _createAudio(src, { loop = false, volume = 1 } = {}) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = volume;
    audio.preload = 'auto';
    return audio;
  }

  _playSfx(src) {
    if (!this.enabled) return;
    const clip = this._createAudio(src, { volume: this.sfxVolume });
    this._duckBgm();
    clip.play().catch(() => {});
  }

  _duckBgm() {
    if (!this.bgmPlaying) return;
    this.bgm.volume = this.bgmDuckedVolume;
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      if (this.bgmPlaying) {
        this.bgm.volume = this.bgmVolume;
      }
    }, 1200);
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.startBgm();
  }

  startBgm() {
    if (!this.enabled || this.bgmPlaying) return;
    this.bgm.volume = this.bgmVolume;
    this.bgm.play().then(() => {
      this.bgmPlaying = true;
    }).catch(() => {});
  }

  playTone(freq, duration, type = 'square', volume = 0.15) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playPlace() {
    this.playTone(300, 0.08, 'square', 0.1);
  }

  playRotate() {
    this.playTone(450, 0.06, 'sine', 0.08);
  }

  playMove() {
    this.playTone(200, 0.04, 'sine', 0.05);
  }

  playMarch() {
    this._playSfx('assets/audio/march.mp3');
  }

  playCharge() {
    this._playSfx('assets/audio/march.mp3');
  }

  playVictory() {
    this._playSfx('assets/audio/victory.wav');
  }

  playCoin() {
    this._playSfx('assets/audio/coin.wav');
  }

  playDefeat() {
    this._playSfx('assets/audio/defeat.wav');
  }

  playTaskComplete() {
    if (!this.enabled || !this.ctx) return;
    this._duckBgm();
    [523, 659, 784].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.12), i * 60);
    });
  }

  playCharacterSound(charId) {
    const character = getCharacter(charId);
    if (!character?.sound) return;
    this._playSfx(character.sound);
  }

  startTerrainAmbience(terrainType) {
    this.stopTerrainAmbience();
    if (!this.enabled || !terrainType) return;

    const src = TERRAIN_SOUNDS[terrainType];
    if (!src) return;

    this.terrainAmbience = this._createAudio(src, {
      loop: true,
      volume: this.terrainBaseVolume,
    });
    this.terrainAmbienceBoosted = false;
    this.terrainAmbience.play().catch(() => {});
  }

  stopTerrainAmbience() {
    if (!this.terrainAmbience) return;
    this.terrainAmbience.pause();
    this.terrainAmbience = null;
    this.terrainAmbienceBoosted = false;
  }

  updateTerrainAmbienceBoost(boosted) {
    if (!this.terrainAmbience || boosted === this.terrainAmbienceBoosted) return;
    this.terrainAmbienceBoosted = boosted;
    this.terrainAmbience.volume = boosted ? this.terrainBoostVolume : this.terrainBaseVolume;
  }
}

const audio = new AudioManager();
