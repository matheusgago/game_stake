# 🐍 Snake Battle ULTRA - Documentação do Projeto

Jogo de arena multiplayer 2D em tempo real desenvolvido com **Node.js, Express, Socket.io, HTML5 Canvas 2D e Web Audio API**.

---

## 📋 Sumário
1. [Visão Geral](#visão-geral)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Arquitetura e Fluxo de Dados](#arquitetura-e-fluxo-de-dados)
4. [Mecânicas de Jogo Implementadas](#mecânicas-de-jogo-implementadas)
5. [Dicionário de Eventos Socket.io](#dicionário-de-eventos-socketio)
6. [Instruções de Instalação e Execução](#instruções-de-instalação-e-execução)

---

## 1. Visão Geral
* **Modelo Autoritativo (Server-Authoritative):** O cliente é apenas um terminal visual. O servidor processa 100% da física, limites de tela, colisões e pontuações a **30 ticks por segundo (30 FPS)**.
* **Gráficos em Tempo Real:** Renderizados via **HTML5 Canvas** usando `requestAnimationFrame` a 60 FPS com interpolação contínua.
* **Áudio Procedural:** Sintetizado nativamente no navegador através da **Web Audio API** (música de fundo Synthwave e efeitos de explosão, portais e escudos sem arquivos de áudio externos).
* **Inteligência Artificial Integrada:** CyberBots entram na partida automaticamente quando há poucos jogadores para manter a arena sempre viva.

---

## 2. Estrutura do Projeto
```
jogo/
├── public/
│   ├── index.html   # Interface principal, modais de login, HUD e Canvas 800x600
│   ├── style.css    # Tema Cyberpunk Dark Neon, Glassmorphism e Screen Shake
│   └── client.js    # Entrada de controles, sintetizador sonoro e loop gráfico Canvas
├── server.js        # Servidor Express + Socket.io, IA dos bots, física e colisões
├── package.json     # Metadados e script de inicialização ("npm start")
└── README.md        # Documentação oficial do projeto
```

---

## 3. Arquitetura e Fluxo de Dados
* **HTTP:** Utilizado exclusivamente para entrega dos arquivos estáticos da pasta `public/`.
* **WebSocket (Socket.io):** Canal TCP persistente para troca de pacotes de baixa latência:
  * `socket.emit`: Mensagens direcionadas a um cliente específico (ex: `init`).
  * `socket.broadcast.emit`: Mensagens enviadas a todos os outros competidores.
  * `io.emit`: Notificações e atualizações de estado globais (`stateUpdate`).

---

## 4. Mecânicas de Jogo Implementadas
1. **Cobras Articuladas:** Segmentos conectados que crescem ao consumir frutas e afinam na cauda. Olhos que acompanham a direção e animação de língua bifurcada.
2. **Turbo (Boost):** Segurar a **Barra de Espaço** acelera a cobra (velocidade de 4 para 7 px/frame) consumindo pequenas quantidades de tamanho.
3. **Obstáculos Mortais:** 4 Barreiras de Choque elétricas e 1 Núcleo de Alta Tensão central.
4. **Portais Quânticos (Warp):** 2 portais giratórios pareados nas extremidades que teletransportam a cobra de um lado para o outro.
5. **Power-ups no Mapa:**
   * 🛡️ **Escudo:** Absorve 1 colisão mortal e salva o jogador.
   * 🧲 **Ímã:** Atrai frutas num raio de 180px por 8 segundos.
   * 👻 **Fantasma:** Torna a cobra translúcida e imune a colisões por 6 segundos.
   * ⚡ **Super Raio:** Velocidade máxima temporária sem gastar tamanho corporal.
6. **Controle de Itens:** Quantidade estrita de **6 frutas na tela**, mantendo o mapa limpo e competitivo.

---

## 5. Dicionário de Eventos Socket.io

| Evento | Direção | Descrição |
| :--- | :--- | :--- |
| `joinGame` | Cliente ➔ Servidor | Envia Nickname e cor escolhida pelo jogador. |
| `init` | Servidor ➔ Cliente | Entrega o estado inicial completo (mapa, frutas, portais, obstáculos). |
| `playerChangeDirection` | Cliente ➔ Servidor | Envia intenção de movimento (`up`, `down`, `left`, `right`). |
| `playerBoost` | Cliente ➔ Servidor | Envia status do turbo (ativo/inativo). |
| `stateUpdate` | Servidor ➔ Todos | Broadcast de posições, pontuações e itens a cada 33ms. |
| `fruitCollected` | Servidor ➔ Todos | Dispara som e centelhas de fruta comida. |
| `powerUpCollected` | Servidor ➔ Todos | Notifica ativação de buff especial. |
| `shieldAbsorb` | Servidor ➔ Todos | Notifica quebra de escudo e ativa Screen Shake. |
| `portalWarp` | Servidor ➔ Todos | Som e partículas de teletransporte. |
| `playerDied` | Servidor ➔ Todos | Notifica eliminação e inicia tela de respawn. |
| `latencyPing/Pong` | Bidirecional | Medição da latência (Ping em milissegundos). |

---

## 6. Instruções de Instalação e Execução

### Pré-requisitos
* Node.js instalado (versão 16 ou superior).

### Passo a Passo
1. No terminal, acesse a pasta do jogo:
   ```bash
   cd c:\Users\mabf.gago\Desktop\jogo
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Acesse no navegador:
   ```
   http://localhost:3000
   ```
