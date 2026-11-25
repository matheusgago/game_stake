// Conexão Socket.io
const socket = io();

// Elementos da Interface
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvasWrapper');
const scoreboard = document.getElementById('scoreboard');
const noticeFeed = document.getElementById('noticeFeed');
const deathScreen = document.getElementById('deathScreen');
const deathCause = document.getElementById('deathCause');
const activeBuffs = document.getElementById('activeBuffs');

const myScoreEl = document.getElementById('myScore');
const myLengthEl = document.getElementById('myLength');
const myKillsEl = document.getElementById('myKills');
const pingValueEl = document.getElementById('pingValue');
const fpsValueEl = document.getElementById('fpsValue');

const joinModal = document.getElementById('joinModal');
const joinForm = document.getElementById('joinForm');
const playerNameInput = document.getElementById('playerName');
const colorPicker = document.getElementById('colorPicker');
const soundToggle = document.getElementById('soundToggle');
const musicToggle = document.getElementById('musicToggle');

// Dimensões do Mundo Aberto Gigante
const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1600;
const HEAD_RADIUS = 12;
const BODY_RADIUS = 10;

// Sistema de Câmera Seguidora
const camera = {
  x: MAP_WIDTH / 2,
  y: MAP_HEIGHT / 2
};

// Estado do Jogo
let myId = null;
let players = {};
let fruits = [];
let powerUps = [];
let obstacles = [];
let portals = [];
let soundEnabled = true;
let musicEnabled = false;

// Cores para escolha
const PALETTE = [
  '#00E676', '#00B0FF', '#FF5252', '#FFD600',
  '#E040FB', '#FF6E40', '#7C4DFF', '#00E5FF'
];
let selectedColor = PALETTE[0];

PALETTE.forEach((color, idx) => {
  const dot = document.createElement('div');
  dot.className = `color-option ${idx === 0 ? 'selected' : ''}`;
  dot.style.backgroundColor = color;
  dot.addEventListener('click', () => {
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    dot.classList.add('selected');
    selectedColor = color;
  });
  colorPicker.appendChild(dot);
});

// Sintetizador de Áudio Nativo (Web Audio API)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }

  playEat(type) {
    if (!soundEnabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const freq = type === 'super' ? 880 : (type === 'golden' ? 660 : 440);
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playPowerUp() {
    if (!soundEnabled || !this.ctx) return;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      const startTime = this.ctx.currentTime + idx * 0.04;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.linearRampToValueAtTime(0.001, startTime + 0.06);
      osc.start(startTime);
      osc.stop(startTime + 0.06);
    });
  }

  playPortal() {
    if (!soundEnabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playShieldBreak() {
    if (!soundEnabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(700, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playKill() {
    if (!soundEnabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(260, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playDeath() {
    if (!soundEnabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const bassline = [110, 110, 130.81, 146.83, 110, 98, 130.81, 164.81];
    this.musicTimer = setInterval(() => {
      if (!musicEnabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassline[this.musicStep % bassline.length], this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.035, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
      this.musicStep++;
    }, 240);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

const sfx = new SoundFX();

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
});

musicToggle.addEventListener('click', () => {
  sfx.init();
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    sfx.startMusic();
    musicToggle.classList.add('active');
  } else {
    sfx.stopMusic();
    musicToggle.classList.remove('active');
  }
});

function triggerScreenShake() {
  canvasWrapper.classList.remove('shake');
  void canvasWrapper.offsetWidth;
  canvasWrapper.classList.add('shake');
}

// Sistema de Partículas
const particles = [];

function addExplosion(x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 3.5 + 2,
      color,
      alpha: 1,
      life: 0.035
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.life;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }
}

// Submissão do Formulário de Entrada
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sfx.init();

  const name = playerNameInput.value.trim() || 'Player';
  socket.emit('joinGame', { name, color: selectedColor });
  joinModal.classList.add('hidden');
});

// Eventos de Rede Socket.io
socket.on('init', (data) => {
  myId = data.id;
  players = data.players || {};
  fruits = data.fruits || [];
  obstacles = data.obstacles || [];
  portals = data.portals || [];

  const me = players[myId];
  if (me) {
    camera.x = me.x;
    camera.y = me.y;
  }
});

socket.on('newPlayer', (player) => {
  players[player.id] = player;
});

socket.on('playerDisconnected', (id) => {
  delete players[id];
});

socket.on('stateUpdate', (data) => {
  players = data.players || {};
  fruits = data.fruits || [];
  powerUps = data.powerUps || [];
  if (data.obstacles) obstacles = data.obstacles;

  const me = players[myId];
  if (me) {
    myScoreEl.textContent = me.score;
    myLengthEl.textContent = me.body ? me.body.length : 12;
    myKillsEl.textContent = me.kills;

    updateBuffsHUD(me.buffs);

    if (!me.alive) {
      deathScreen.classList.remove('hidden');
    } else {
      deathScreen.classList.add('hidden');
    }
  }
});

function updateBuffsHUD(buffs) {
  if (!buffs) return;
  activeBuffs.innerHTML = '';

  if (buffs.shield) {
    const b = document.createElement('div');
    b.className = 'buff-badge';
    b.innerHTML = '🛡️ ESCUDO ATIVO';
    b.style.borderColor = '#00B0FF';
    activeBuffs.appendChild(b);
  }
  if (buffs.magnetTimer > 0) {
    const b = document.createElement('div');
    b.className = 'buff-badge';
    b.innerHTML = `🧲 ÍMÃ (${Math.ceil(buffs.magnetTimer / 30)}s)`;
    b.style.borderColor = '#FFD600';
    activeBuffs.appendChild(b);
  }
  if (buffs.ghostTimer > 0) {
    const b = document.createElement('div');
    b.className = 'buff-badge';
    b.innerHTML = `👻 FANTASMA (${Math.ceil(buffs.ghostTimer / 30)}s)`;
    b.style.borderColor = '#E040FB';
    activeBuffs.appendChild(b);
  }
  if (buffs.speedTimer > 0) {
    const b = document.createElement('div');
    b.className = 'buff-badge';
    b.innerHTML = `⚡ RAIO (${Math.ceil(buffs.speedTimer / 30)}s)`;
    b.style.borderColor = '#00E676';
    activeBuffs.appendChild(b);
  }
}

socket.on('fruitCollected', (data) => {
  addExplosion(data.x, data.y, data.color, 8);
  if (data.playerId === myId) {
    sfx.playEat(data.value > 3 ? 'super' : (data.value > 1 ? 'golden' : 'normal'));
  }
});

socket.on('powerUpCollected', (data) => {
  addExplosion(data.x, data.y, data.color, 16);
  if (data.playerId === myId) {
    sfx.playPowerUp();
  }
});

socket.on('shieldAbsorb', (data) => {
  addExplosion(data.x, data.y, '#00B0FF', 22);
  sfx.playShieldBreak();
  triggerScreenShake();
});

socket.on('portalWarp', (data) => {
  addExplosion(data.x, data.y, data.color, 18);
  if (data.playerId === myId) {
    sfx.playPortal();
  }
});

socket.on('playerDied', (data) => {
  const victim = players[data.id];
  if (victim) {
    addExplosion(victim.x, victim.y, victim.color, 26);
  }
  triggerScreenShake();

  if (data.id === myId) {
    deathCause.textContent = `Eliminado por: ${data.killerName}`;
    sfx.playDeath();
  } else {
    sfx.playKill();
  }
});

socket.on('gameNotice', (data) => {
  const item = document.createElement('div');
  item.className = `notice-item ${data.type || 'info'}`;
  item.textContent = data.text;
  noticeFeed.appendChild(item);
  setTimeout(() => { item.remove(); }, 3800);
});

// Ping
setInterval(() => {
  if (socket.connected) {
    socket.emit('latencyPing', Date.now());
  }
}, 2000);

socket.on('latencyPong', (clientTime) => {
  const ping = Date.now() - clientTime;
  pingValueEl.textContent = `${ping} ms`;
});

// Captura de Teclado
const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right'
};

window.addEventListener('keydown', (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) {
    e.preventDefault();
    socket.emit('playerChangeDirection', dir);
  }
  if (e.code === 'Space') {
    e.preventDefault();
    socket.emit('playerBoost', true);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    socket.emit('playerBoost', false);
  }
});

// Touch
document.querySelectorAll('.dpad-btn').forEach(btn => {
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const dir = btn.getAttribute('data-dir');
    socket.emit('playerChangeDirection', dir);
  });
});

const btnTouchBoost = document.getElementById('btnTouchBoost');
if (btnTouchBoost) {
  btnTouchBoost.addEventListener('touchstart', (e) => {
    e.preventDefault();
    socket.emit('playerBoost', true);
  });
  btnTouchBoost.addEventListener('touchend', () => {
    socket.emit('playerBoost', false);
  });
}

// Leaderboard
function updateLeaderboard() {
  const sorted = Object.values(players).sort((a, b) => b.score - a.score);
  scoreboard.innerHTML = '';

  sorted.slice(0, 10).forEach((p, idx) => {
    const item = document.createElement('div');
    const isMe = p.id === myId;
    item.className = `rank-item ${isMe ? 'is-me' : ''}`;

    let medal = `${idx + 1}º`;
    if (idx === 0) medal = '🥇';
    else if (idx === 1) medal = '🥈';
    else if (idx === 2) medal = '🥉';

    item.innerHTML = `
      <div class="rank-info">
        <span class="rank-num">${medal}</span>
        <span class="rank-dot" style="background-color: ${p.color};"></span>
        <span>${isMe ? '⭐ ' + p.name : p.name}</span>
      </div>
      <span class="rank-score">${p.score}</span>
    `;
    scoreboard.appendChild(item);
  });
}

// Desenho da Grade no Mundo Gigante (2400 x 1600)
function drawGrid() {
  const step = 50;
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
  ctx.lineWidth = 1;

  for (let x = 0; x < MAP_WIDTH; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, MAP_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < MAP_HEIGHT; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(MAP_WIDTH, y);
    ctx.stroke();
  }

  // Borda Energizada do Mundo Aberto
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 18;
  ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  ctx.shadowBlur = 0;
}

// Desenho dos Portais Quânticos
function drawPortals() {
  const time = Date.now() / 300;
  portals.forEach(portal => {
    ctx.save();
    ctx.translate(portal.x, portal.y);

    for (let r = portal.radius; r > 6; r -= 7) {
      ctx.beginPath();
      ctx.arc(0, 0, r, time * (r % 2 === 0 ? 1 : -1), time * (r % 2 === 0 ? 1 : -1) + Math.PI * 1.5);
      ctx.strokeStyle = portal.color;
      ctx.shadowColor = portal.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  });
}

// Desenho dos Obstáculos Móveis
function drawObstacles() {
  const time = Date.now() / 200;
  const pulse = Math.sin(time) * 3 + 8;

  obstacles.forEach(obs => {
    ctx.save();
    ctx.fillStyle = '#170c14';
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(obs.x, obs.y, obs.width, obs.height);
    ctx.clip();

    ctx.strokeStyle = 'rgba(255, 23, 68, 0.35)';
    ctx.lineWidth = 6;
    const stripeOffset = (time * 15) % 20;
    for (let x = obs.x - obs.height + stripeOffset - 20; x < obs.x + obs.width + 20; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, obs.y + obs.height);
      ctx.lineTo(x + obs.height, obs.y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = pulse;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

    ctx.shadowBlur = 0;
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.fillStyle = '#ff8a80';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obs.label, obs.x + obs.width / 2, obs.y + obs.height / 2);
    ctx.restore();
  });
}

// Desenho dos Power-ups
function drawPowerUps() {
  const time = Date.now() / 250;
  powerUps.forEach(pu => {
    const pulse = Math.sin(time * 2) * 2;
    const r = pu.radius + pulse;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, r, 0, Math.PI * 2);
    ctx.fillStyle = pu.color;
    ctx.shadowColor = pu.color;
    ctx.shadowBlur = 14;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    let icon = '⚡';
    if (pu.type === 'shield') icon = '🛡️';
    if (pu.type === 'magnet') icon = '🧲';
    if (pu.type === 'ghost') icon = '👻';
    ctx.fillText(icon, pu.x, pu.y);
    ctx.restore();
  });
}

// Desenho do Minimapa / Radar Tático (Renderizado em Espaço de Tela)
function drawMinimap() {
  const mmWidth = 180;
  const mmHeight = 120; // Proporção do mapa 2400x1600 (1.5)
  const mmX = canvas.width - mmWidth - 14;
  const mmY = canvas.height - mmHeight - 14;
  const scaleX = mmWidth / MAP_WIDTH;
  const scaleY = mmHeight / MAP_HEIGHT;

  ctx.save();
  // Fundo com transparência
  ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(mmX, mmY, mmWidth, mmHeight);
  ctx.strokeRect(mmX, mmY, mmWidth, mmHeight);

  // Linhas de coordenadas centrais
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(mmX + mmWidth / 2, mmY); ctx.lineTo(mmX + mmWidth / 2, mmY + mmHeight);
  ctx.moveTo(mmX, mmY + mmHeight / 2); ctx.lineTo(mmX + mmWidth, mmY + mmHeight / 2);
  ctx.stroke();

  // Obstáculos no radar
  ctx.fillStyle = 'rgba(255, 23, 68, 0.7)';
  obstacles.forEach(obs => {
    ctx.fillRect(mmX + obs.x * scaleX, mmY + obs.y * scaleY, Math.max(2, obs.width * scaleX), Math.max(2, obs.height * scaleY));
  });

  // Portais no radar
  portals.forEach(port => {
    ctx.fillStyle = port.color;
    ctx.beginPath();
    ctx.arc(mmX + port.x * scaleX, mmY + port.y * scaleY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Outros jogadores
  for (const id in players) {
    const p = players[id];
    if (!p || !p.alive || id === myId) continue;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(mmX + p.x * scaleX, mmY + p.y * scaleY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Jogador local (destacado em verde brilhante)
  const me = players[myId];
  if (me && me.alive) {
    ctx.fillStyle = '#00e676';
    ctx.shadowColor = '#00e676';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(mmX + me.x * scaleX, mmY + me.y * scaleY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Retângulo do campo de visão da câmera
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  const vpX = mmX + (camera.x - canvas.width / 2) * scaleX;
  const vpY = mmY + (camera.y - canvas.height / 2) * scaleY;
  const vpW = canvas.width * scaleX;
  const vpH = canvas.height * scaleY;
  ctx.strokeRect(vpX, vpY, vpW, vpH);

  // Título do Radar
  ctx.font = 'bold 9px Orbitron, sans-serif';
  ctx.fillStyle = 'rgba(0, 229, 255, 0.8)';
  ctx.textAlign = 'left';
  ctx.fillText('RADAR TÁTICO', mmX + 6, mmY + 12);

  ctx.restore();
}

// Renderização Completa do Game Loop
let lastFrameTime = performance.now();
let frameCount = 0;
let fpsTimer = 0;

function render(now) {
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  frameCount++;
  fpsTimer += delta;
  if (fpsTimer >= 1000) {
    fpsValueEl.textContent = frameCount;
    frameCount = 0;
    fpsTimer = 0;
  }

  // 1. Atualizar Câmera Suavemente Acompanhando a Minhoca/Cobra
  const me = players[myId];
  if (me && me.alive) {
    camera.x += (me.x - camera.x) * 0.12;
    camera.y += (me.y - camera.y) * 0.12;
  }

  // Limpa o Canvas inteiro
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Aplica a Transformação da Câmera no Espaço de Mundo
  ctx.save();
  ctx.translate(Math.round(canvas.width / 2 - camera.x), Math.round(canvas.height / 2 - camera.y));

  // A) Grade do Mundo Gigante
  drawGrid();

  // B) Portais Quânticos
  drawPortals();

  // C) Obstáculos Móveis
  drawObstacles();

  // D) Power-ups
  drawPowerUps();

  // E) Frutas
  const time = Date.now() / 250;
  fruits.forEach(f => {
    const pulse = Math.sin(time + f.x) * 1.5;
    const radius = Math.max(2, f.radius + pulse);

    ctx.save();
    ctx.beginPath();
    ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = f.type === 'super' ? 14 : 8;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(f.x - radius * 0.3, f.y - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
    ctx.restore();
  });

  // F) Cobras / Minhocas
  for (const id in players) {
    const p = players[id];
    if (!p || !p.alive || !p.body || p.body.length === 0) continue;

    const isMe = id === myId;
    const isGhost = p.buffs && p.buffs.ghostTimer > 0;

    ctx.save();
    if (isGhost) ctx.globalAlpha = 0.45;

    // Corpo articulado
    for (let i = p.body.length - 1; i >= 0; i--) {
      const seg = p.body[i];
      const ratio = 1 - (i / p.body.length) * 0.45;
      const r = BODY_RADIUS * ratio;

      ctx.beginPath();
      ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;

      if (isMe && p.isBoosting) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
      }
      ctx.fill();
    }

    // Cabeça
    ctx.beginPath();
    ctx.arc(p.x, p.y, HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = isMe ? 14 : 6;
    ctx.fill();

    if (isMe) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Aura de Escudo
    if (p.buffs && p.buffs.shield) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, HEAD_RADIUS + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#00B0FF';
      ctx.shadowColor = '#00B0FF';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Olhos e Língua
    let eyeOffsetX = 0, eyeOffsetY = 0;
    let eye1X = 0, eye1Y = 0, eye2X = 0, eye2Y = 0;
    let tongueStartX = p.x, tongueStartY = p.y;
    let tongueEndX = p.x, tongueEndY = p.y;

    if (p.direction === 'right') {
      eyeOffsetX = 4;
      eye1X = p.x + eyeOffsetX; eye1Y = p.y - 4;
      eye2X = p.x + eyeOffsetX; eye2Y = p.y + 4;
      tongueStartX = p.x + HEAD_RADIUS; tongueEndX = tongueStartX + 6;
    } else if (p.direction === 'left') {
      eyeOffsetX = -4;
      eye1X = p.x + eyeOffsetX; eye1Y = p.y - 4;
      eye2X = p.x + eyeOffsetX; eye2Y = p.y + 4;
      tongueStartX = p.x - HEAD_RADIUS; tongueEndX = tongueStartX - 6;
    } else if (p.direction === 'up') {
      eyeOffsetY = -4;
      eye1X = p.x - 4; eye1Y = p.y + eyeOffsetY;
      eye2X = p.x + 4; eye2Y = p.y + eyeOffsetY;
      tongueStartY = p.y - HEAD_RADIUS; tongueEndY = tongueStartY - 6;
    } else if (p.direction === 'down') {
      eyeOffsetY = 4;
      eye1X = p.x - 4; eye1Y = p.y + eyeOffsetY;
      eye2X = p.x + 4; eye2Y = p.y + eyeOffsetY;
      tongueStartY = p.y + HEAD_RADIUS; tongueEndY = tongueStartY + 6;
    }

    if (Math.sin(time * 3) > 0.4) {
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tongueStartX, tongueStartY);
      ctx.lineTo(tongueEndX, tongueEndY);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, 3, 0, Math.PI * 2);
    ctx.arc(eye2X, eye2Y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#050a12';
    ctx.beginPath();
    ctx.arc(eye1X + (eyeOffsetX * 0.3), eye1Y + (eyeOffsetY * 0.3), 1.5, 0, Math.PI * 2);
    ctx.arc(eye2X + (eyeOffsetX * 0.3), eye2Y + (eyeOffsetY * 0.3), 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y - HEAD_RADIUS - 6);

    ctx.restore();
  }

  // G) Partículas no mundo
  updateParticles();

  // Restaura o contexto para o Espaço de Tela (Screen Space)
  ctx.restore();

  // 3. Renderiza o Radar / Minimapa e Leaderboard na Tela
  drawMinimap();
  updateLeaderboard();

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
