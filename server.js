const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Configurações do Mapa e Física
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const HEAD_RADIUS = 12;
const BODY_RADIUS = 10;
const BASE_SPEED = 4;
const BOOST_SPEED = 7;
const SUPER_SPEED = 8.5;
const INITIAL_BODY_LENGTH = 12;
const MAX_BODY_LENGTH = 75;
const MAX_FRUITS = 6;
const TICK_RATE = 30; // 30 FPS no servidor

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Obstáculos Mortais
const OBSTACLES = [
  { id: 1, x: 170, y: 130, width: 120, height: 26, type: 'laser', label: '⚡ BARREIRA' },
  { id: 2, x: 510, y: 130, width: 120, height: 26, type: 'laser', label: '⚡ BARREIRA' },
  { id: 3, x: 360, y: 260, width: 80, height: 80, type: 'core', label: '☠️ NÚCLEO' },
  { id: 4, x: 170, y: 444, width: 120, height: 26, type: 'laser', label: '⚡ BARREIRA' },
  { id: 5, x: 510, y: 444, width: 120, height: 26, type: 'laser', label: '⚡ BARREIRA' }
];

// Portais de Teletransporte Quântico (Warp Portals)
const PORTALS = [
  { id: 'portal_a', x: 75, y: 300, radius: 24, target: 'portal_b', color: '#00E5FF', label: 'ALPHA' },
  { id: 'portal_b', x: 725, y: 300, radius: 24, target: 'portal_a', color: '#FF6E40', label: 'BETA' }
];

// Colisão geométrica Círculo vs Retângulo (AABB)
function checkCircleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (radius * radius);
}

function isCollidingWithAnyObstacle(x, y, radius) {
  return OBSTACLES.some(obs => checkCircleRectCollision(x, y, radius, obs.x, obs.y, obs.width, obs.height));
}

// Cores dos jogadores
const DEFAULT_COLORS = [
  '#00E676', '#00B0FF', '#FF5252', '#FFD600',
  '#E040FB', '#FF6E40', '#7C4DFF', '#00E5FF'
];

// Estado do Jogo (Fonte Única da Verdade)
const players = {};
let fruits = [];
let powerUps = [];

function getRandom(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Gerador de frutas
function createFruit(type = null, x = null, y = null) {
  if (!type) {
    const roll = Math.random();
    if (roll < 0.70) type = 'normal';
    else if (roll < 0.90) type = 'golden';
    else type = 'super';
  }

  let posX = x;
  let posY = y;
  if (posX === null || posY === null) {
    let attempts = 0;
    do {
      posX = getRandom(40, MAP_WIDTH - 40);
      posY = getRandom(40, MAP_HEIGHT - 40);
      attempts++;
    } while (isCollidingWithAnyObstacle(posX, posY, 25) && attempts < 30);
  }

  let value = 1;
  let radius = 7;
  let color = '#FF1744';

  if (type === 'golden') {
    value = 3;
    radius = 9;
    color = '#FFD700';
  } else if (type === 'super') {
    value = 5;
    radius = 11;
    color = '#00E5FF';
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    x: posX,
    y: posY,
    type,
    value,
    radius,
    color
  };
}

// Gerador de Power-ups (Escudo, Ímã, Fantasma, Raio)
const POWERUP_TYPES = [
  { type: 'shield', color: '#00B0FF', label: '🛡️ Escudo' },
  { type: 'magnet', color: '#FFD600', label: '🧲 Ímã' },
  { type: 'ghost', color: '#E040FB', label: '👻 Fantasma' },
  { type: 'speed', color: '#00E676', label: '⚡ Super Raio' }
];

function createPowerUp() {
  const pType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  let posX, posY;
  let attempts = 0;
  do {
    posX = getRandom(60, MAP_WIDTH - 60);
    posY = getRandom(60, MAP_HEIGHT - 60);
    attempts++;
  } while (isCollidingWithAnyObstacle(posX, posY, 30) && attempts < 30);

  return {
    id: Math.random().toString(36).substring(2, 9),
    x: posX,
    y: posY,
    radius: 12,
    type: pType.type,
    color: pType.color,
    label: pType.label,
    duration: 300 // dura 10 segundos no chão
  };
}

// Inicializa frutas
for (let i = 0; i < MAX_FRUITS; i++) {
  fruits.push(createFruit());
}

function initPlayer(socketId, name, color, isBot = false) {
  let x, y;
  let attempts = 0;
  do {
    x = getRandom(80, MAP_WIDTH - 80);
    y = getRandom(80, MAP_HEIGHT - 80);
    attempts++;
  } while (isCollidingWithAnyObstacle(x, y, 35) && attempts < 30);

  const validColor = color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
  const validName = isBot ? `[BOT] ${name}` : ((name && name.trim().slice(0, 12)) || `Snake_${socketId.slice(0, 4)}`);

  const body = [];
  for (let i = 0; i < INITIAL_BODY_LENGTH; i++) {
    body.push({ x: x - i * 3, y });
  }

  return {
    id: socketId,
    name: validName,
    color: validColor,
    isBot,
    x,
    y,
    direction: 'right',
    nextDirection: 'right',
    speed: BASE_SPEED,
    isBoosting: false,
    score: 0,
    alive: true,
    respawnTimer: 0,
    portalCooldown: 0,
    body,
    targetLength: INITIAL_BODY_LENGTH,
    kills: 0,
    buffs: {
      shield: false,
      magnetTimer: 0,
      ghostTimer: 0,
      speedTimer: 0
    }
  };
}

// Spawna Bots se houver poucos jogadores na arena
const BOT_NAMES = ['Cyber_Viper', 'Neon_Apex'];
function ensureBots() {
  const currentBots = Object.values(players).filter(p => p.isBot);
  const totalPlayers = Object.keys(players).length;

  if (totalPlayers < 3 && currentBots.length < 2) {
    const botName = BOT_NAMES[currentBots.length] || `AI_${Math.floor(Math.random() * 100)}`;
    const botId = `bot_${botName}`;
    if (!players[botId]) {
      players[botId] = initPlayer(botId, botName, '#FF6E40', true);
    }
  }
}
ensureBots();

// Inteligência Artificial do Bot
function updateBotAI(bot) {
  if (!bot.alive) return;

  // 1. Procurar alvo mais próximo (PowerUp ou Fruta)
  let target = null;
  let minDist = Infinity;

  // Prioriza power-ups
  powerUps.forEach(p => {
    const d = Math.hypot(bot.x - p.x, bot.y - p.y);
    if (d < minDist) { minDist = d; target = p; }
  });

  // Se não houver power-up perto, busca fruta
  if (!target) {
    fruits.forEach(f => {
      const d = Math.hypot(bot.x - f.x, bot.y - f.y);
      if (d < minDist) { minDist = d; target = f; }
    });
  }

  const possibleDirs = ['up', 'down', 'left', 'right'];
  const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // Escolhe direção desejada para o alvo
  let desiredDirs = [];
  if (target) {
    if (Math.abs(target.x - bot.x) > Math.abs(target.y - bot.y)) {
      desiredDirs.push(target.x > bot.x ? 'right' : 'left');
      desiredDirs.push(target.y > bot.y ? 'down' : 'up');
    } else {
      desiredDirs.push(target.y > bot.y ? 'down' : 'up');
      desiredDirs.push(target.x > bot.x ? 'right' : 'left');
    }
  }

  // Função que testa se andar em direção 'd' por N pixels colide
  function isSafeDirection(d, testDist = 45) {
    if (opposites[bot.direction] === d) return false;
    let testX = bot.x;
    let testY = bot.y;
    if (d === 'up') testY -= testDist;
    if (d === 'down') testY += testDist;
    if (d === 'left') testX -= testDist;
    if (d === 'right') testX += testDist;

    // Bordas
    if (testX < 25 || testX > MAP_WIDTH - 25 || testY < 25 || testY > MAP_HEIGHT - 25) {
      return false;
    }
    // Obstáculos
    if (isCollidingWithAnyObstacle(testX, testY, HEAD_RADIUS + 4)) {
      return false;
    }
    // Corpos de jogadores
    for (const otherId in players) {
      const other = players[otherId];
      if (!other.alive) continue;
      const start = (other.id === bot.id) ? 8 : 0;
      for (let s = start; s < other.body.length; s += 2) {
        if (Math.hypot(testX - other.body[s].x, testY - other.body[s].y) < HEAD_RADIUS + BODY_RADIUS) {
          return false;
        }
      }
    }
    return true;
  }

  // Tenta direção desejada; se não for segura, tenta qualquer direção segura
  let chosenDir = null;
  for (const d of desiredDirs) {
    if (isSafeDirection(d)) { chosenDir = d; break; }
  }
  if (!chosenDir && isSafeDirection(bot.direction)) {
    chosenDir = bot.direction;
  }
  if (!chosenDir) {
    const safeOnes = possibleDirs.filter(d => isSafeDirection(d));
    if (safeOnes.length > 0) chosenDir = safeOnes[0];
  }

  if (chosenDir) {
    bot.nextDirection = chosenDir;
  }
}

// Conexões Socket.io
io.on('connection', (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  socket.on('latencyPing', (clientTime) => {
    socket.emit('latencyPong', clientTime);
  });

  socket.on('joinGame', (data) => {
    players[socket.id] = initPlayer(socket.id, data?.name, data?.color);

    socket.emit('init', {
      id: socket.id,
      players,
      fruits,
      obstacles: OBSTACLES,
      portals: PORTALS,
      map: { width: MAP_WIDTH, height: MAP_HEIGHT }
    });

    socket.broadcast.emit('newPlayer', players[socket.id]);
    io.emit('gameNotice', { text: `${players[socket.id].name} entrou na arena!`, type: 'info' });
  });

  socket.on('playerChangeDirection', (newDir) => {
    const player = players[socket.id];
    if (!player || !player.alive) return;
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (opposites[player.direction] !== newDir) {
      player.nextDirection = newDir;
    }
  });

  socket.on('playerBoost', (isBoosting) => {
    const player = players[socket.id];
    if (player && player.alive) {
      player.isBoosting = Boolean(isBoosting);
    }
  });

  socket.on('disconnect', () => {
    const player = players[socket.id];
    if (player) {
      io.emit('gameNotice', { text: `${player.name} desconectou.`, type: 'info' });
      delete players[socket.id];
      io.emit('playerDisconnected', socket.id);
      ensureBots();
    }
  });
});

// Drop de orbs ao morrer
function dropOrbsFromPlayer(player) {
  const count = Math.min(3, Math.floor(player.body.length / 10));
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i + 1) * (player.body.length / (count + 1)));
    const seg = player.body[idx] || player.body[0];
    if (seg && fruits.length < MAX_FRUITS + 3) {
      fruits.push(createFruit('normal', seg.x, seg.y));
    }
  }
}

// Timer para gerar Power-ups periodicamente no mapa
let powerUpTimer = 0;

// Game Loop Autorizado do Servidor (Tick a cada 33.3ms = 30 FPS)
setInterval(() => {
  const playerIds = Object.keys(players);

  // 1. Gerenciar Power-ups ativos
  powerUpTimer++;
  if (powerUpTimer >= 300) { // a cada 10 segundos
    powerUpTimer = 0;
    if (powerUps.length < 2) {
      powerUps.push(createPowerUp());
    }
  }
  for (let i = powerUps.length - 1; i >= 0; i--) {
    powerUps[i].duration--;
    if (powerUps[i].duration <= 0) powerUps.splice(i, 1);
  }

  // 2. Atualizar Bots e Jogadores
  for (const id of playerIds) {
    const p = players[id];

    // Atualiza IA do Bot
    if (p.isBot) updateBotAI(p);

    // Se estiver morto, processa o respawn
    if (!p.alive) {
      p.respawnTimer -= 1;
      if (p.respawnTimer <= 0) {
        const fresh = initPlayer(p.id, p.name.replace('[BOT] ', ''), p.color, p.isBot);
        fresh.score = Math.floor(p.score * 0.5);
        fresh.kills = p.kills;
        players[id] = fresh;
        io.emit('gameNotice', { text: `${fresh.name} renasceu!`, type: 'info' });
      }
      continue;
    }

    // Decrementa timers de buffs
    if (p.buffs.magnetTimer > 0) p.buffs.magnetTimer--;
    if (p.buffs.ghostTimer > 0) p.buffs.ghostTimer--;
    if (p.buffs.speedTimer > 0) p.buffs.speedTimer--;
    if (p.portalCooldown > 0) p.portalCooldown--;

    // Aplica direção validada
    p.direction = p.nextDirection;

    // Velocidade
    if (p.buffs.speedTimer > 0) {
      p.speed = SUPER_SPEED;
    } else if (p.isBoosting && p.body.length > 5) {
      p.speed = BOOST_SPEED;
      if (Math.random() < 0.15 && p.body.length > INITIAL_BODY_LENGTH) {
        p.body.pop();
        p.targetLength = Math.max(INITIAL_BODY_LENGTH, p.targetLength - 1);
      }
    } else {
      p.speed = BASE_SPEED;
    }

    // Move a cabeça
    if (p.direction === 'up') p.y -= p.speed;
    else if (p.direction === 'down') p.y += p.speed;
    else if (p.direction === 'left') p.x -= p.speed;
    else if (p.direction === 'right') p.x += p.speed;

    // A) Teletransporte através dos Portais Quânticos
    if (p.portalCooldown <= 0) {
      for (const portal of PORTALS) {
        const dist = Math.hypot(p.x - portal.x, p.y - portal.y);
        if (dist < portal.radius + HEAD_RADIUS) {
          const dest = PORTALS.find(item => item.id === portal.target);
          if (dest) {
            p.x = dest.x;
            p.y = dest.y;
            p.portalCooldown = 45; // 1.5s de cooldown
            io.emit('portalWarp', { x: dest.x, y: dest.y, color: portal.color, playerId: p.id });
            break;
          }
        }
      }
    }

    // B) Ímã de Frutas (Atrai frutas no raio de 180px)
    if (p.buffs.magnetTimer > 0) {
      fruits.forEach(f => {
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (d < 180 && d > 5) {
          f.x += ((p.x - f.x) / d) * 4;
          f.y += ((p.y - f.y) / d) * 4;
        }
      });
    }

    // Atualiza histórico do corpo
    p.body.unshift({ x: p.x, y: p.y });
    while (p.body.length > p.targetLength) {
      p.body.pop();
    }

    // C) Coleta de Power-ups
    for (let puIdx = powerUps.length - 1; puIdx >= 0; puIdx--) {
      const pu = powerUps[puIdx];
      if (Math.hypot(p.x - pu.x, p.y - pu.y) < HEAD_RADIUS + pu.radius) {
        // Ativa o Buff correspondente
        if (pu.type === 'shield') p.buffs.shield = true;
        else if (pu.type === 'magnet') p.buffs.magnetTimer = 240; // 8s
        else if (pu.type === 'ghost') p.buffs.ghostTimer = 180;  // 6s
        else if (pu.type === 'speed') p.buffs.speedTimer = 180;  // 6s

        io.emit('powerUpCollected', {
          playerId: p.id,
          type: pu.type,
          x: pu.x,
          y: pu.y,
          color: pu.color,
          label: pu.label
        });
        io.emit('gameNotice', { text: `✨ ${p.name} obteve ${pu.label}!`, type: 'info' });
        powerUps.splice(puIdx, 1);
      }
    }

    // D) Função auxiliar de dano com absorção de Escudo
    function handleDamage(killerName, alertMsg) {
      if (p.buffs.ghostTimer > 0) return false; // Fantasma ignora dano

      if (p.buffs.shield) {
        p.buffs.shield = false; // Escudo absorve o golpe
        io.emit('shieldAbsorb', { x: p.x, y: p.y, playerId: p.id });
        io.emit('gameNotice', { text: `🛡️ O Escudo protegeu ${p.name}!`, type: 'info' });
        return false;
      }

      p.alive = false;
      p.respawnTimer = 60;
      dropOrbsFromPlayer(p);
      io.emit('playerDied', { id: p.id, killerName });
      io.emit('gameNotice', { text: alertMsg, type: 'danger' });
      return true;
    }

    // E) Colisão com as bordas da arena
    if (p.x < HEAD_RADIUS || p.x > MAP_WIDTH - HEAD_RADIUS ||
      p.y < HEAD_RADIUS || p.y > MAP_HEIGHT - HEAD_RADIUS) {
      if (handleDamage('Parede de Choque', `⚡ ${p.name} colidiu com a barreira externa!`)) {
        continue;
      } else {
        // Rebate se foi protegido por escudo
        p.x = Math.max(HEAD_RADIUS + 2, Math.min(MAP_WIDTH - HEAD_RADIUS - 2, p.x));
        p.y = Math.max(HEAD_RADIUS + 2, Math.min(MAP_HEIGHT - HEAD_RADIUS - 2, p.y));
      }
    }

    // F) Colisão com Obstáculos
    let obstacleHit = false;
    for (const obs of OBSTACLES) {
      if (checkCircleRectCollision(p.x, p.y, HEAD_RADIUS, obs.x, obs.y, obs.width, obs.height)) {
        if (handleDamage(obs.label, `💥 ${p.name} bateu em ${obs.label}!`)) {
          obstacleHit = true;
          break;
        }
      }
    }
    if (obstacleHit) continue;

    // G) Colisão com Frutas
    for (let fIdx = fruits.length - 1; fIdx >= 0; fIdx--) {
      const f = fruits[fIdx];
      const dist = Math.hypot(p.x - f.x, p.y - f.y);

      if (dist < HEAD_RADIUS + f.radius) {
        p.score += f.value;
        p.targetLength = Math.min(MAX_BODY_LENGTH, p.targetLength + (f.type === 'super' ? 3 : 1));

        io.emit('fruitCollected', {
          fruitId: f.id,
          x: f.x,
          y: f.y,
          color: f.color,
          value: f.value,
          playerId: p.id
        });

        fruits.splice(fIdx, 1);
      }
    }
  }

  // 3. Colisão entre jogadores (Cabeça vs Corpo de outros)
  for (const idA of playerIds) {
    const pA = players[idA];
    if (!pA || !pA.alive || pA.buffs.ghostTimer > 0) continue;

    for (const idB of playerIds) {
      const pB = players[idB];
      if (!pB || !pB.alive) continue;

      const startIdx = idA === idB ? 12 : 0;
      for (let s = startIdx; s < pB.body.length; s += 2) {
        const seg = pB.body[s];
        const dist = Math.hypot(pA.x - seg.x, pA.y - seg.y);

        if (dist < HEAD_RADIUS + BODY_RADIUS - 4) {
          if (pA.buffs.shield) {
            pA.buffs.shield = false;
            io.emit('shieldAbsorb', { x: pA.x, y: pA.y, playerId: pA.id });
            io.emit('gameNotice', { text: `🛡️ O Escudo salvou ${pA.name} de um ataque!`, type: 'info' });
            break;
          }

          pA.alive = false;
          pA.respawnTimer = 60;
          dropOrbsFromPlayer(pA);

          if (idA !== idB) {
            pB.kills += 1;
            pB.score += 10;
            pB.targetLength = Math.min(MAX_BODY_LENGTH, pB.targetLength + 4);
            io.emit('gameNotice', { text: `⚔️ ${pB.name} eliminou ${pA.name}! (+10 pts)`, type: 'kill' });
          } else {
            io.emit('gameNotice', { text: `💥 ${pA.name} colidiu consigo mesmo!`, type: 'danger' });
          }

          io.emit('playerDied', { id: pA.id, killerName: idA !== idB ? pB.name : 'próprio corpo' });
          break;
        }
      }
    }
  }

  // 4. Repor frutas mantendo a arena balanceada (MAX_FRUITS)
  while (fruits.length < MAX_FRUITS) {
    fruits.push(createFruit());
  }
  if (fruits.length > MAX_FRUITS) {
    fruits = fruits.slice(0, MAX_FRUITS);
  }

  // 5. Transmitir estado completo do jogo
  io.emit('stateUpdate', {
    players,
    fruits,
    powerUps
  });
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Snake Battle ULTRA rodando em http://localhost:${PORT}`);
});
