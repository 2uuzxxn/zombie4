// sketch.js

let phase = PHASE_LOBBY;
let gameTimer = 0;
let betrayalTriggered = false;
let winner = null;
let soloTimer = 0;
let deadPlayerId = null;
let betrayalAnnounceFade = 0;
let showHowto = false;

// ── 아이디 / 계정 시스템
let accounts = {};
let currentUserId = null;

// lobby 서브 상태
let lobbySubState = 'main';
let inputBuffer = '';
let inputError  = '';

let highScore = 0;
let isNewHighScore = false;

// ── 승리 애니메이션
let fillAnimActive = false;
let fillAnimRow = 0;
const FILL_SPEED = 1.5;
let pixelFillColor = '';

// ── 혈흔 파티클 (로비 효과)
let bloodDrops = [];

// ── 사운드 시스템 (Web Audio API)
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playZombieRoar() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const dist1 = ctx.createWaveShaper();
    const g1 = ctx.createGain();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i * 2) / 1024 - 1;
      curve[i] = Math.max(-0.9, Math.min(0.9, x * 12)) * 0.8;
    }
    dist1.curve = curve;
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(65, now);
    osc1.frequency.linearRampToValueAtTime(32, now + 0.4);
    osc1.frequency.linearRampToValueAtTime(55, now + 0.9);
    osc1.frequency.linearRampToValueAtTime(25, now + 1.5);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.6, now + 0.1);
    g1.gain.setValueAtTime(0.5, now + 1.1);
    g1.gain.linearRampToValueAtTime(0, now + 1.7);
    osc1.connect(dist1); dist1.connect(g1); g1.connect(ctx.destination);
    osc1.start(now); osc1.stop(now + 1.8);
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 1.8, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = last * 0.95 + (Math.random() * 2 - 1) * 0.05;
      d[i] = last * 10 + (Math.random() * 2 - 1) * 0.2;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(350, now);
    lp.frequency.linearRampToValueAtTime(150, now + 1.6);
    lp.Q.value = 6;
    const gN = ctx.createGain();
    gN.gain.setValueAtTime(0, now);
    gN.gain.linearRampToValueAtTime(0.3, now + 0.15);
    gN.gain.setValueAtTime(0.2, now + 1.1);
    gN.gain.linearRampToValueAtTime(0, now + 1.7);
    noiseSrc.connect(lp); lp.connect(gN); gN.connect(ctx.destination);
    noiseSrc.start(now); noiseSrc.stop(now + 1.8);
  } catch(e) {}
}

let ambientTimer = 0;
const AMBIENT_INTERVAL = 300;

function playAmbientGroan() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.0);
  } catch(e) {}
}

function playSoundDrink() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1400, now);
    clickOsc.frequency.setValueAtTime(800, now + 0.03);
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.linearRampToValueAtTime(0.01, now + 0.05);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);
    const sr = ctx.sampleRate;
    const bufSize = sr * 0.6;
    const buf = ctx.createBuffer(1, bufSize, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { d[i] = Math.random() * 2 - 1; }
    const fizzSrc = ctx.createBufferSource();
    fizzSrc.buffer = buf;
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(6000, now);
    hpFilter.frequency.exponentialRampToValueAtTime(2500, now + 0.5);
    const fizzGain = ctx.createGain();
    fizzGain.gain.setValueAtTime(0, now + 0.01);
    fizzGain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    fizzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    fizzSrc.connect(hpFilter);
    hpFilter.connect(fizzGain);
    fizzGain.connect(ctx.destination);
    fizzSrc.start(now + 0.01);
    fizzSrc.stop(now + 0.6);
  } catch(e) {}
}

function playSoundPowerup() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.linearRampToValueAtTime(650, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = 22;
    lfoGain.gain.value = 45;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch(e) {}
}

function playSoundZombie() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const dist = ctx.createWaveShaper();
    const g = ctx.createGain();
    const c2 = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i * 2) / 512 - 1;
      c2[i] = Math.max(-0.8, Math.min(0.8, x * 8));
    }
    dist.curve = c2;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(45, now + 0.4);
    osc.frequency.linearRampToValueAtTime(70, now + 0.7);
    osc.frequency.linearRampToValueAtTime(35, now + 1.0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.05);
    g.gain.setValueAtTime(0.3, now + 0.7);
    g.gain.linearRampToValueAtTime(0, now + 1.0);
    osc.connect(dist); dist.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 1.0);
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 0.9, sr);
    const nd = buf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1);
    const ns = ctx.createBufferSource(); ns.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 180;
    bp.Q.value = 3;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, now);
    gn.gain.linearRampToValueAtTime(0.18, now + 0.1);
    gn.gain.linearRampToValueAtTime(0, now + 0.9);
    ns.connect(bp); bp.connect(gn); gn.connect(ctx.destination);
    ns.start(now); ns.stop(now + 0.9);
  } catch(e) {}
}

// ── 플레이어 픽셀맵
const _PMAP = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,0],
  [1,1,0,1,1,0,1,1],
  [0,1,1,0,0,1,1,0],
  [0,1,1,0,0,1,1,0],
];

const _ZMAP = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
  [0,1,4,1,1,4,1,0],
  [1,1,0,1,1,0,1,1],
  [0,1,1,0,0,1,1,0],
  [0,1,1,0,0,1,1,0],
];

const _PFACE = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
];

const _ZFACE = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
];

function _drawPMap(p, map, ox, oy, ps, c1, c2, c3, c4, flipH) {
  p.noStroke();
  const COLS8 = map[0].length;
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < COLS8; c++) {
      const col = flipH ? COLS8 - 1 - c : c;
      const v = map[r][col];
      if (v === 0) continue;
      if      (v === 1) p.fill(c1);
      else if (v === 2) p.fill(c2);
      else if (v === 3) p.fill(c3);
      else if (v === 4) p.fill(c4);
      p.rect(ox + c * ps, oy + r * ps, ps, ps);
    }
  }
}

function _drawKey(p, label, x, y, w, h, col) {
  p.fill(10, 10, 18);
  p.stroke(col);
  p.strokeWeight(1.5);
  p.rect(x, y, w, h, 4);
  p.noStroke();
  p.fill(col);
  p.textFont('Share Tech Mono');
  p.textSize(10);
  p.textAlign(p.CENTER, p.CENTER);
  p.text(label, x + w / 2, y + h / 2);
}

function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  frameRate(FRAME_RATE);
  textFont('Share Tech Mono');
  resetGame();
  _initBloodDrops();
}

function _initBloodDrops() {
  bloodDrops = [];
  const margin = 120;
  for (let i = 0; i < 35; i++) {
    bloodDrops.push(_newBloodSplatter(margin));
  }
}

function _newBloodSplatter(margin) {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0)      { x = Math.random() * CANVAS_W; y = Math.random() * margin; }
  else if (side === 1) { x = Math.random() * CANVAS_W; y = CANVAS_H - Math.random() * margin; }
  else if (side === 2) { x = Math.random() * margin; y = Math.random() * CANVAS_H; }
  else                 { x = CANVAS_W - Math.random() * margin; y = Math.random() * CANVAS_H; }
  return {
    x, y,
    size: 6 + Math.random() * 22,
    alpha: 30 + Math.random() * 60,
    type: Math.floor(Math.random() * 3),
    angle: Math.random() * Math.PI * 2,
    drips: Math.floor(Math.random() * 3),
    dripOffsets: Array.from({length: 3}, () => ({
      ox: (Math.random() - 0.5) * 16,
      oy: Math.random() * 20 + 4,
      size: 2 + Math.random() * 5
    }))
  };
}

function resetGame() {
  initGrid();
  initZombies();
  initPlayers();
  initTiles(this);
  gameTimer = GAME_TOTAL_TIME * FRAME_RATE;
  betrayalTriggered = false;
  winner = null;
  betrayalAnnounceFade = 0;
  soloTimer = 0;
  deadPlayerId = null;
  notifications = [];
  phase = PHASE_LOBBY;
  isNewHighScore = false;
  showHowto = false;
  fillAnimActive = false;
  fillAnimRow = 0;
  lobbySubState = 'main';
  inputBuffer = '';
  inputError = '';
  ambientTimer = 0;
}

function draw() {
  background(COLOR_EMPTY);
  if (phase === PHASE_LOBBY) { drawLobby(this); return; }

  if (phase !== PHASE_END) {
    ambientTimer++;
    if (ambientTimer >= AMBIENT_INTERVAL) {
      ambientTimer = 0;
      playAmbientGroan();
    }
  }

  if (phase === PHASE_END) {
    drawGrid(this); drawZombies(this);
    playerA.draw(this); playerB.draw(this);
    if (fillAnimActive) { _drawFillAnim(this); return; }
    drawResultScreen(this, countTiles(), winner, highScore, isNewHighScore);
    return;
  }

  if (betrayalAnnounceFade > 0) {
    drawGrid(this); drawTiles(this); drawZombies(this);
    playerA.draw(this); playerB.draw(this);
    drawBetrayalAnnounce(this);
    drawUI(this, phase, gameTimer / FRAME_RATE, countTiles());
    return;
  }

  gameTimer--;
  const timeLeftSec = gameTimer / FRAME_RATE;
  if (!betrayalTriggered && timeLeftSec <= BETRAYAL_TRIGGER_TIME) _triggerBetrayal();

  if (phase === PHASE_SOLO) {
    soloTimer--;
    if (soloTimer <= 0) _reviveDeadPlayer();
  }

  updateTiles(this);
  updateZombies([playerA, playerB], this);
  if (playerA.alive) playerA.update(playerB, zombies, phase, this);
  if (playerB.alive) playerB.update(playerA, zombies, phase, this);

  _checkEndConditions(timeLeftSec);

  drawGrid(this); drawTiles(this); drawZombies(this);
  playerA.draw(this); playerB.draw(this);
  drawBetrayalAnnounce(this);
  drawUI(this, phase, timeLeftSec, countTiles());
}

function _drawFillAnim(p) {
  fillAnimRow += FILL_SPEED;
  if (fillAnimRow >= ROWS) { fillAnimRow = ROWS; fillAnimActive = false; }
  p.noStroke();
  const col = p.color(pixelFillColor);
  p.fill(col);
  p.rect(0, 0, CANVAS_W, fillAnimRow * TILE_SIZE);
}

function _triggerBetrayal() {
  betrayalTriggered = true;
  phase = PHASE_BETRAYAL;
  const midC = Math.floor(COLS / 2);
  const midR = Math.floor(ROWS / 2);
  if (!playerA.alive) playerA.revive(midR - 3, midC - 5, OWNER_A);
  if (!playerB.alive) playerB.revive(midR + 3, midC + 5, OWNER_B);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].owner === OWNER_TEAM) {
        grid[r][c].owner = c < midC ? OWNER_A : OWNER_B;
        grid[r][c].dirty = true;
      }
    }
  }
  playerA.setPhase(PHASE_BETRAYAL);
  playerB.setPhase(PHASE_BETRAYAL);
  for (const t of playerA.tail) setOwner(t.r, t.c, OWNER_A);
  for (const t of playerB.tail) setOwner(t.r, t.c, OWNER_B);
  showBetrayalAnnounce(this);
}

function _checkEndConditions(timeLeftSec) {
  if (gameTimer <= 0) { _endGame('timer'); return; }
  if (!playerA.alive && !playerB.alive) { _endGame('both_dead'); return; }
  if (phase === PHASE_COOP) {
    if (!playerA.alive || !playerB.alive) {
      phase = PHASE_SOLO;
      deadPlayerId = !playerA.alive ? 'A' : 'B';
      soloTimer = SOLO_TIME_LIMIT * FRAME_RATE;
      const survivor = deadPlayerId === 'A' ? 'B' : 'A';
      showNotification(survivor, `P${deadPlayerId} 사망! ${SOLO_TIME_LIMIT}초 후 부활 & 배신 30초!`, '#FF9800');
    }
  }
  if (phase === PHASE_BETRAYAL) {
    if (!playerA.alive && playerB.alive) { winner = 'B'; _endGame('elimination'); return; }
    if (!playerB.alive && playerA.alive) { winner = 'A'; _endGame('elimination'); return; }
  }
}

function _reviveDeadPlayer() {
  const midR = Math.floor(ROWS / 2);
  const midC = Math.floor(COLS / 2);
  const dead = deadPlayerId === 'A' ? playerA : playerB;
  const deadSpawnR = midR + (deadPlayerId === 'A' ? -3 : 3);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].owner === OWNER_TEAM) {
        grid[r][c].owner = c < midC ? OWNER_A : OWNER_B;
        grid[r][c].dirty = true;
      }
    }
  }
  dead.revive(deadSpawnR, midC - (deadPlayerId === 'A' ? 5 : -5), deadPlayerId === 'A' ? OWNER_A : OWNER_B);
  gameTimer = EMERGENCY_BETRAYAL_TIME * FRAME_RATE;
  betrayalTriggered = true;
  phase = PHASE_BETRAYAL;
  playerA.setPhase(PHASE_BETRAYAL);
  playerB.setPhase(PHASE_BETRAYAL);
  deadPlayerId = null;
  showBetrayalAnnounce(this);
  showNotification('A', '부활! 배신 타이머 30초 발동!', '#FF5252');
}

function _endGame(reason) {
  phase = PHASE_END;
  const counts = countTiles();
  if (reason === 'timer') {
    if (playerA.alive && playerB.alive) {
      if (counts.A > counts.B) winner = 'A';
      else if (counts.B > counts.A) winner = 'B';
      else winner = 'draw';
    } else if (playerA.alive) { winner = 'A'; }
    else if (playerB.alive)   { winner = 'B'; }
    else                      { winner = 'zombie'; }
  } else if (reason === 'both_dead') {
    winner = 'zombie';
  }
  if (!betrayalTriggered) { winner = 'zombie'; }
  const best = Math.max(counts.A, counts.B, counts.team);
  if (currentUserId) {
    if (!accounts[currentUserId]) accounts[currentUserId] = { highScore: 0 };
    if (best > accounts[currentUserId].highScore) {
      accounts[currentUserId].highScore = best;
      isNewHighScore = true;
    }
    highScore = accounts[currentUserId].highScore;
  } else {
    if (best > highScore) { highScore = best; isNewHighScore = true; }
  }
  fillAnimActive = true;
  fillAnimRow = 0;
  pixelFillColor = winner === 'A' ? COLOR_A :
                   winner === 'B' ? COLOR_B :
                   winner === 'draw' ? '#FFD600' : COLOR_ZOMBIE;
}

function keyPressed() {
  if (phase === PHASE_LOBBY && (lobbySubState === 'login' || lobbySubState === 'register')) {
    if (keyCode === 27) { lobbySubState = 'main'; inputBuffer = ''; inputError = ''; return; }
    if (keyCode === 13) { _submitInput(); return; }
    if (keyCode === 8)  { inputBuffer = inputBuffer.slice(0, -1); return; }
    if (key.length === 1) { if (inputBuffer.length < 16) inputBuffer += key; }
    return;
  }
  if (phase === PHASE_LOBBY && keyCode === 32 && !showHowto) {
    playZombieRoar(); phase = PHASE_COOP; return;
  }
  if (phase === PHASE_LOBBY && keyCode === 27 && showHowto) { showHowto = false; return; }
  if (phase === PHASE_END && keyCode === 32) { playZombieRoar(); resetGame(); return; }
  if (betrayalAnnounceFade > 0) return;
  if (phase === PHASE_COOP || phase === PHASE_SOLO || phase === PHASE_BETRAYAL) {
    playerA.handleKeyPressed(keyCode);
    playerB.handleKeyPressed(keyCode);
  }
}

function _submitInput() {
  const id = inputBuffer.trim();
  if (!id) { inputError = '아이디를 입력하세요.'; return; }
  if (lobbySubState === 'login') {
    if (!accounts[id]) { inputError = '존재하지 않는 아이디입니다.'; return; }
    currentUserId = id;
    highScore = accounts[id].highScore;
    inputBuffer = ''; inputError = '';
    lobbySubState = 'main';
  } else if (lobbySubState === 'register') {
    if (accounts[id]) { inputError = '이미 사용 중인 아이디입니다.'; return; }
    accounts[id] = { highScore: 0 };
    currentUserId = id;
    highScore = 0;
    inputBuffer = ''; inputError = '';
    lobbySubState = 'main';
  }
}

function mousePressed() {
  const cx = CANVAS_W / 2;

  if (phase === PHASE_LOBBY && (lobbySubState === 'login' || lobbySubState === 'register')) {
    const pw = 340, ph = 200;
    const px = cx - pw / 2;
    const py = CANVAS_H / 2 - ph / 2;
    if (mouseX > px + pw - 36 && mouseX < px + pw - 6 && mouseY > py + 6 && mouseY < py + 36) {
      lobbySubState = 'main'; inputBuffer = ''; inputError = ''; return;
    }
    const btnY2 = py + ph - 52;
    if (mouseX > cx - 70 && mouseX < cx + 70 && mouseY > btnY2 && mouseY < btnY2 + 34) {
      _submitInput(); return;
    }
    if (mouseX < px || mouseX > px + pw || mouseY < py || mouseY > py + ph) {
      lobbySubState = 'main'; inputBuffer = ''; inputError = ''; return;
    }
    return;
  }

  if (phase === PHASE_LOBBY && showHowto) {
    const pw = 390, ph = 280;
    const px = cx - pw / 2;
    const py = CANVAS_H / 2 - ph / 2;
    if (mouseX > px + pw - 36 && mouseX < px + pw - 6 && mouseY > py + 6 && mouseY < py + 36) {
      showHowto = false; return;
    }
    if (mouseX < px || mouseX > px + pw || mouseY < py || mouseY > py + ph) {
      showHowto = false; return;
    }
    return;
  }

  if (phase === PHASE_LOBBY) {
    const startBtnY = 490;
    const howtoBtnY = startBtnY + 70;
    const accountAreaY = howtoBtnY + 60;

    if (mouseX > cx - 180 && mouseX < cx + 180 && mouseY > startBtnY && mouseY < startBtnY + 50) {
      playZombieRoar(); phase = PHASE_COOP; return;
    }
    if (mouseX > cx - 100 && mouseX < cx + 100 && mouseY > howtoBtnY && mouseY < howtoBtnY + 36) {
      showHowto = true; return;
    }
    if (currentUserId) {
      if (mouseX > cx - 42 && mouseX < cx + 42 && mouseY > accountAreaY + 46 && mouseY < accountAreaY + 72) {
        currentUserId = null; highScore = 0; return;
      }
    } else {
      if (mouseX > cx - 88 && mouseX < cx - 6 && mouseY > accountAreaY && mouseY < accountAreaY + 30) {
        lobbySubState = 'login'; inputBuffer = ''; inputError = ''; return;
      }
      if (mouseX > cx + 6 && mouseX < cx + 88 && mouseY > accountAreaY && mouseY < accountAreaY + 30) {
        lobbySubState = 'register'; inputBuffer = ''; inputError = ''; return;
      }
    }
  }

  if (phase === PHASE_END) {
    const cy = CANVAS_H / 2;
    if (mouseX > cx - 120 && mouseX < cx + 120 && mouseY > cy + 100 && mouseY < cy + 145) {
      playZombieRoar(); resetGame(); return;
    }
  }
}

// ── 배신 공지
function showBetrayalAnnounce(p) { betrayalAnnounceFade = FRAME_RATE * 2; }
function drawBetrayalAnnounce(p) {
  if (betrayalAnnounceFade <= 0) return;
  betrayalAnnounceFade--;
  const alpha = Math.min(255, betrayalAnnounceFade * 5);

  p.noStroke(); p.fill(0, 0, 0, alpha * 0.6);
  p.rect(0, 0, CANVAS_W, CANVAS_H);

  p.fill(15, 0, 0, alpha * 0.95);
  p.rect(0, CANVAS_H / 2 - 52, CANVAS_W, 104);

  p.fill(255, 23, 68, alpha);
  p.rect(0, CANVAS_H / 2 - 52, CANVAS_W, 2);
  p.rect(0, CANVAS_H / 2 + 50, CANVAS_W, 2);

  p.textFont('Share Tech Mono');
  p.textAlign(p.CENTER, p.CENTER);

  p.fill(180, 0, 0, alpha * 0.4);
  p.textSize(28); p.text('! BETRAYAL PHASE !', CANVAS_W / 2 + 2, CANVAS_H / 2 - 16 + 2);
  p.fill(255, 23, 68, alpha);
  p.text('! BETRAYAL PHASE !', CANVAS_W / 2, CANVAS_H / 2 - 16);

  p.fill(220, 220, 220, alpha * 0.9);
  p.textSize(13); p.text('팀원도 이제 적입니다', CANVAS_W / 2, CANVAS_H / 2 + 18);

  p.textSize(20); p.fill(255, 23, 68, alpha * 0.7);
  p.text('▲', CANVAS_W / 2 - 140, CANVAS_H / 2 - 14);
  p.text('▲', CANVAS_W / 2 + 140, CANVAS_H / 2 - 14);
}

// ── 결과 화면
function drawResultScreen(p, counts, winner, highScore, isNewHighScore) {
  const cx = CANVAS_W / 2, cy = CANVAS_H / 2;

  p.fill(0, 0, 0, 225); p.noStroke(); p.rect(0, 0, CANVAS_W, CANVAS_H);

  const panW = 480, panH = 400;
  const panX = cx - panW / 2, panY = cy - panH / 2;

  p.fill(0, 0, 0, 160);
  p.rect(panX + 8, panY + 8, panW, panH, 16);

  p.fill(8, 8, 14);
  p.stroke(winner === 'A' ? '#FF1744' :
           winner === 'B' ? '#00B0FF' :
           winner === 'draw' ? '#FFD600' : '#AA00FF');
  p.strokeWeight(2);
  p.rect(panX, panY, panW, panH, 16);
  p.noStroke();

  const hdrH = 50;
  const hdrCol = winner === 'A' ? '#FF1744' :
                 winner === 'B' ? '#00B0FF' :
                 winner === 'draw' ? '#FFD600' : '#AA00FF';
  p.fill(hdrCol);
  p.rect(panX, panY, panW, hdrH, 16, 16, 0, 0);

  p.textFont('Share Tech Mono');
  p.textAlign(p.CENTER, p.CENTER);
  p.fill(0, 0, 0, 200);
  p.textSize(11);
  p.text('GAME OVER', cx, panY + hdrH / 2);

  // 승리 텍스트 — 검정 외곽선으로 가시성 최대화
  const winText = winner === 'A' ? 'PLAYER  A  WIN' :
                  winner === 'B' ? 'PLAYER  B  WIN' :
                  winner === 'draw' ? 'DRAW' : 'ZOMBIE  WIN';
  p.textSize(26);
  p.fill(0, 0, 0, 220);
  for (let ox = -2; ox <= 2; ox++) {
    for (let oy = -2; oy <= 2; oy++) {
      if (ox === 0 && oy === 0) continue;
      p.text(winText, cx + ox, panY + hdrH + 22 + oy);
    }
  }
  p.fill(winner === 'A' ? '#FF6E6E' :
         winner === 'B' ? '#80D8FF' :
         winner === 'draw' ? '#FFD600' : '#E040FB');
  p.text(winText, cx, panY + hdrH + 22);

  const facePS = 10;
  const faceW = 8 * facePS;
  const faceH = 5 * facePS;
  const faceX = cx - faceW / 2;
  const faceY = panY + hdrH + 46;

  if (winner === 'A') {
    _drawPMap(p, _PFACE, faceX, faceY, facePS, '#C62828', '#eeeeee', '#111111', '#ffffff', false);
  } else if (winner === 'B') {
    _drawPMap(p, _PFACE, faceX, faceY, facePS, '#01579B', '#eeeeee', '#111111', '#ffffff', true);
  } else if (winner === 'zombie') {
    _drawPMap(p, _ZFACE, faceX, faceY, facePS, '#4A148C', '#ccffcc', '#1B5E20', '#e8ffe8', false);
  } else {
    const faceX2 = cx - faceW - 14;
    _drawPMap(p, _PFACE, faceX2, faceY, facePS, '#C62828', '#eeeeee', '#111111', '#ffffff', false);
    _drawPMap(p, _PFACE, cx + 14, faceY, facePS, '#01579B', '#eeeeee', '#111111', '#ffffff', true);
  }

  const divY = faceY + faceH + 14;
  p.stroke(30, 30, 50); p.strokeWeight(1);
  p.line(panX + 30, divY, panX + panW - 30, divY); p.noStroke();

  const statsY = divY + 16;
  p.textFont('Share Tech Mono'); p.textSize(10);

  if (!betrayalTriggered && winner === 'zombie') {
    p.fill('#00E676'); p.textAlign(p.LEFT, p.CENTER);
    p.text('TEAM', panX + 40, statsY);
    p.fill(200); p.textAlign(p.RIGHT, p.CENTER);
    p.text(counts.team + ' tiles', panX + panW - 40, statsY);
  } else {
    const barW = panW - 80;
    const barX = panX + 40;
    const totalTiles = ROWS * COLS;

    p.fill(20, 20, 35); p.rect(barX, statsY, barW, 12, 6);
    const wA = Math.max(4, (counts.A / totalTiles) * barW);
    p.fill('#FF1744'); p.rect(barX, statsY, wA, 12, 6, 0, 0, 6);
    p.fill('#FF6E6E'); p.textAlign(p.LEFT, p.CENTER);
    p.text('A  ' + counts.A, barX, statsY - 9);

    p.fill(20, 20, 35); p.rect(barX, statsY + 22, barW, 12, 6);
    const wB = Math.max(4, (counts.B / totalTiles) * barW);
    p.fill('#00B0FF'); p.rect(barX + barW - wB, statsY + 22, wB, 12, 0, 6, 6, 0);
    p.fill('#80D8FF'); p.textAlign(p.RIGHT, p.CENTER);
    p.text(counts.B + '  B', barX + barW, statsY + 22 + 9 + 6);

    p.fill(100); p.textAlign(p.CENTER, p.CENTER);
    const zPct = Math.round((counts.Z / totalTiles) * 100);
    p.text('ZOMBIE ' + counts.Z + ' (' + zPct + '%)', cx, statsY + 52);
  }

  const scoreY = statsY + 74;
  p.stroke(30, 30, 50); p.strokeWeight(1);
  p.line(panX + 30, scoreY - 6, panX + panW - 30, scoreY - 6); p.noStroke();

  p.textFont('Share Tech Mono'); p.textSize(11);
  p.textAlign(p.CENTER, p.CENTER);
  if (currentUserId) {
    const userBest = accounts[currentUserId] ? accounts[currentUserId].highScore : 0;
    if (isNewHighScore) {
      const blink = Math.floor(p.frameCount / 10) % 2 === 0;
      p.fill(blink ? '#FFD600' : '#FF8A00');
      p.textSize(13); p.text('★  NEW HIGH SCORE  ★', cx, scoreY + 6);
      p.fill(180); p.textSize(10);
      p.text(currentUserId + ' · BEST ' + userBest + ' tiles', cx, scoreY + 24);
    } else {
      const best = Math.max(counts.A, counts.B, counts.team);
      p.fill(140); p.text('SCORE ' + best, cx, scoreY + 6);
      p.fill(80); p.text('BEST ' + userBest + '  (' + currentUserId + ')', cx, scoreY + 22);
    }
  } else {
    if (isNewHighScore) {
      const blink = Math.floor(p.frameCount / 10) % 2 === 0;
      p.fill(blink ? '#FFD600' : '#FF8A00');
      p.textSize(13); p.text('★  NEW HIGH SCORE  ★', cx, scoreY + 6);
      p.fill(180); p.textSize(10); p.text('BEST ' + highScore + ' tiles', cx, scoreY + 24);
    } else {
      p.fill(120); p.textSize(10);
      p.text('BEST ' + highScore + ' tiles', cx, scoreY + 14);
    }
  }

  const btnW = 240, btnH = 40;
  const btnX = cx - btnW / 2;
  const btnY2 = panY + panH - 54;
  const blink2 = Math.floor(p.frameCount / 15) % 2 === 0;
  p.noFill(); p.stroke(0, 230, 118, blink2 ? 100 : 40); p.strokeWeight(4);
  p.rect(btnX - 2, btnY2 - 2, btnW + 4, btnH + 4, 10);
  p.fill(blink2 ? '#00C853' : '#1B5E20');
  p.stroke('#00E676'); p.strokeWeight(1.5);
  p.rect(btnX, btnY2, btnW, btnH, 8);
  p.noStroke();
  p.textFont('Share Tech Mono');
  p.fill(0, 0, 0, 160); p.textSize(13);
  p.text('▶  RESTART  [SPACE]', cx + 1, btnY2 + btnH / 2 + 1);
  p.fill(blink2 ? '#CCFF90' : '#FFFFFF');
  p.text('▶  RESTART  [SPACE]', cx, btnY2 + btnH / 2);
}

// ── 로비 화면
function drawLobby(p) {
  p.background(6, 6, 10);
  p.noStroke();

  for (let y = 0; y < CANVAS_H; y += 3) {
    p.fill(0, 0, 0, 18);
    p.rect(0, y, CANVAS_W, 1);
  }

  _updateDrawBloodDrops(p);

  p.stroke('#00E676'); p.strokeWeight(1);
  p.line(30, 20, CANVAS_W - 30, 20);
  p.line(30, CANVAS_H - 20, CANVAS_W - 30, CANVAS_H - 20);
  p.noStroke();

  const cornerSize = 16;
  p.stroke('#00E676'); p.strokeWeight(2); p.noFill();
  p.line(20, 20, 20 + cornerSize, 20); p.line(20, 20, 20, 20 + cornerSize);
  p.line(CANVAS_W-20, 20, CANVAS_W-20-cornerSize, 20); p.line(CANVAS_W-20, 20, CANVAS_W-20, 20+cornerSize);
  p.line(20, CANVAS_H-20, 20+cornerSize, CANVAS_H-20); p.line(20, CANVAS_H-20, 20, CANVAS_H-20-cornerSize);
  p.line(CANVAS_W-20, CANVAS_H-20, CANVAS_W-20-cornerSize, CANVAS_H-20); p.line(CANVAS_W-20, CANVAS_H-20, CANVAS_W-20, CANVAS_H-20-cornerSize);
  p.noStroke();

  p.textAlign(p.CENTER, p.CENTER);
  const cx = CANVAS_W / 2;

  p.textFont('Share Tech Mono');
  p.fill(0, 230, 118, 30); p.textSize(40);
  p.text('ZOMBIE SLIDE DUO', cx, 68);
  p.text('ZOMBIE SLIDE DUO', cx + 2, 68);
  p.text('ZOMBIE SLIDE DUO', cx - 2, 68);
  p.fill('#00E676');
  p.text('ZOMBIE SLIDE DUO', cx, 68);

  p.textFont('Nunito');
  p.textSize(13); p.fill(140);
  p.text('좀비 슬라이드 듀오  ·  2인 협력  →  배신 영역 점령', cx, 102);
  p.textSize(10); p.fill(60);
  p.text('제작자 : 이현서  이유진  전재민', cx, 124);

  const ps = 18, charW = 8 * ps, charH = 9 * ps, charTopY = 200;
  const axMid = 140, bxMid = CANVAS_W - 140;

  p.fill(12, 6, 6); p.stroke('#FF1744'); p.strokeWeight(1);
  p.rect(axMid - charW/2 - 12, charTopY - 28, charW + 24, charH + 56, 8);
  p.fill(6, 6, 12); p.stroke('#00B0FF'); p.strokeWeight(1);
  p.rect(bxMid - charW/2 - 12, charTopY - 28, charW + 24, charH + 56, 8);
  const zps = 16, zW = 8 * zps, zTopY = charTopY + (charH - 9 * zps) / 2;
  p.fill(6, 14, 6); p.stroke('#00E676'); p.strokeWeight(1);
  p.rect(cx - zW/2 - 12, zTopY - 28, zW + 24, 9 * zps + 56, 8);
  p.noStroke();

  _drawPMap(p, _PMAP, axMid - charW/2, charTopY, ps, '#C62828', '#eeeeee', '#111111', '#ffffff', false);
  _drawPMap(p, _PMAP, bxMid - charW/2, charTopY, ps, '#01579B', '#eeeeee', '#111111', '#ffffff', true);
  _drawPMap(p, _ZMAP, cx - zW/2, zTopY, zps, '#1B5E20', '#ccffcc', '#0D3B14', '#e8ffe8', false);

  p.textFont('Share Tech Mono'); p.textSize(10); p.noStroke();
  p.fill('#FF1744'); p.text('PLAYER  A', axMid, charTopY - 14);
  p.fill('#00B0FF'); p.text('PLAYER  B', bxMid, charTopY - 14);
  p.fill('#00E676'); p.text('ZOMBIE', cx, zTopY - 14);

  const vsY = charTopY + charH / 2;
  p.textSize(16); p.fill(45);
  p.text('VS', (axMid + cx) / 2, vsY);
  p.text('VS', (bxMid + cx) / 2, vsY);

  const kw = 28, kh = 24, gap = 4, keyTopY = charTopY + charH + 24;
  _drawKey(p, 'W', axMid-kw/2,         keyTopY,        kw, kh, COLOR_A);
  _drawKey(p, 'A', axMid-kw*1.5-gap,   keyTopY+kh+gap, kw, kh, COLOR_A);
  _drawKey(p, 'S', axMid-kw/2,         keyTopY+kh+gap, kw, kh, COLOR_A);
  _drawKey(p, 'D', axMid+kw/2+gap,     keyTopY+kh+gap, kw, kh, COLOR_A);
  _drawKey(p, '↑', bxMid-kw/2,         keyTopY,        kw, kh, COLOR_B);
  _drawKey(p, '←', bxMid-kw*1.5-gap,   keyTopY+kh+gap, kw, kh, COLOR_B);
  _drawKey(p, '↓', bxMid-kw/2,         keyTopY+kh+gap, kw, kh, COLOR_B);
  _drawKey(p, '→', bxMid+kw/2+gap,     keyTopY+kh+gap, kw, kh, COLOR_B);

  const startBtnY = 490, btnW = 360, btnH = 50, btnX = cx - btnW/2;
  const blink = Math.floor(p.frameCount / 18) % 2 === 0;
  p.noFill(); p.stroke(0, 230, 118, blink ? 90 : 30); p.strokeWeight(6);
  p.rect(btnX-3, startBtnY-3, btnW+6, btnH+6, 12);
  p.fill(blink ? '#00C853' : '#1B5E20'); p.stroke('#00E676'); p.strokeWeight(1.5);
  p.rect(btnX, startBtnY, btnW, btnH, 10); p.noStroke();
  p.textFont('Share Tech Mono');
  p.fill(0,0,0,160); p.textSize(18);
  p.text('▶  START GAME  [SPACE]', cx+1, startBtnY + btnH/2 + 1);
  p.fill(blink ? '#CCFF90' : '#FFFFFF');
  p.text('▶  START GAME  [SPACE]', cx, startBtnY + btnH/2);

  const howtoBtnY = startBtnY + 70, htW = 200, htH = 36, htX = cx - htW/2;
  const htBlink = Math.floor(p.frameCount / 25) % 2 === 0;
  p.fill(htBlink ? '#0D2137' : '#060E1A'); p.stroke('#00B0FF'); p.strokeWeight(1);
  p.rect(htX, howtoBtnY, htW, htH, 8); p.noStroke();
  p.textFont('Share Tech Mono'); p.fill('#80D8FF'); p.textSize(12);
  p.text('?  HOW TO PLAY', cx, howtoBtnY + htH/2);

  const accountAreaY = howtoBtnY + 60;
  p.textFont('Share Tech Mono'); p.textSize(10);
  if (currentUserId) {
    p.fill(70); p.text('LOGGED IN', cx, accountAreaY);
    p.fill(200); p.textSize(12); p.text(currentUserId, cx, accountAreaY + 18);
    p.fill(60); p.textSize(10); p.text('BEST ' + highScore + ' tiles', cx, accountAreaY + 34);
    p.fill(28,28,40); p.stroke(50); p.strokeWeight(1);
    p.rect(cx-42, accountAreaY+46, 84, 26, 5); p.noStroke();
    p.fill(100); p.textSize(10); p.text('LOGOUT', cx, accountAreaY + 59);
  } else {
    p.fill(28,28,40); p.stroke(50); p.strokeWeight(1);
    p.rect(cx-88, accountAreaY, 82, 30, 6);
    p.fill(36,36,54); p.stroke(60);
    p.rect(cx+6, accountAreaY, 82, 30, 6); p.noStroke();
    p.fill(180); p.textSize(11);
    p.text('LOGIN', cx-47, accountAreaY+15);
    p.text('SIGN UP', cx+47, accountAreaY+15);
    p.fill(50); p.textSize(9);
    p.text('아이디로 로그인하여 최고기록을 관리하세요', cx, accountAreaY+44);
  }

  if (showHowto) {
    p.fill(0,0,0,200); p.noStroke(); p.rect(0,0,CANVAS_W,CANVAS_H);
    const pw=400, ph=290, px=cx-pw/2, py=CANVAS_H/2-ph/2;
    p.fill(8,8,16); p.stroke('#00E676'); p.strokeWeight(1.5);
    p.rect(px,py,pw,ph,10); p.noStroke();
    p.textFont('Share Tech Mono');
    p.fill('#00E676'); p.textSize(12); p.textAlign(p.LEFT,p.TOP);
    p.text('[ HOW TO PLAY ]', px+22, py+18);
    p.fill(70); p.textSize(14); p.textAlign(p.RIGHT,p.TOP);
    p.text('✕', px+pw-14, py+12);
    p.textFont('Nunito'); p.fill(150); p.textSize(11); p.textAlign(p.LEFT,p.TOP);
    const lines = [
      '⏱  협력 30초  →  배신 30초',
      '🐾  꼬리를 뻗다 자기 땅으로 돌아오면 영역 확보',
      '💀  상대 꼬리를 끊으면 사망',
      '      머리끼리 부딪히면 밀려남',
      '🧟  좀비 꼬리를 밟으면 좀비 사망',
      '',
      '💊  약 :  보너스 땅 획득',
      '🩸  피 :  좀비 가속',
      '⚡  에너지드링크 :  속도 2배 + 강철꼬리',
    ];
    for (let i = 0; i < lines.length; i++) {
      p.text(lines[i], px+22, py+52+i*21);
    }
  }

  if (lobbySubState === 'login' || lobbySubState === 'register') {
    p.fill(0,0,0,210); p.noStroke(); p.rect(0,0,CANVAS_W,CANVAS_H);
    const pw=340, ph=200, px=cx-pw/2, py=CANVAS_H/2-ph/2;
    p.fill(8,8,18); p.stroke('#00E676'); p.strokeWeight(1.5);
    p.rect(px,py,pw,ph,10); p.noStroke();
    p.textFont('Share Tech Mono');
    p.fill(255); p.textSize(13); p.textAlign(p.CENTER,p.TOP);
    p.text(lobbySubState === 'login' ? 'LOGIN' : 'SIGN UP', cx, py+20);
    p.fill(70); p.textSize(14); p.textAlign(p.RIGHT,p.TOP);
    p.text('✕', px+pw-14, py+12);
    p.fill(110); p.textSize(10); p.textAlign(p.CENTER,p.TOP);
    p.text(lobbySubState === 'login' ? '아이디를 입력하세요 (최대 16자)' : '새 아이디를 입력하세요 (최대 16자)', cx, py+50);
    const ibX=px+20, ibY=py+72, ibW=pw-40, ibH=34;
    p.fill(16,16,28); p.stroke('#00E676'); p.strokeWeight(1);
    p.rect(ibX,ibY,ibW,ibH,5); p.noStroke();
    const cursor = Math.floor(p.frameCount/15)%2===0 ? '|' : '';
    p.fill(220); p.textSize(13); p.textAlign(p.LEFT,p.CENTE
