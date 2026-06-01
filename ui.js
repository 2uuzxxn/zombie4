// ui.js — HUD 리디자인 (바이오해저드 네온 컨셉)
let notifications = [];

function showNotification(playerId, msg, color) {
  notifications.push({ playerId, msg, color, timer: 120 });
  if (notifications.length > 3) notifications.shift();
}

function drawUI(p, phase, timeLeft, counts) {
  p.push();
  p.textFont('Share Tech Mono');

  const hudH = 48;

  p.noStroke();
  p.fill(0, 0, 0, 230);
  p.rect(0, 0, CANVAS_W, hudH);

  const glowCol = phase === PHASE_BETRAYAL ? '#FF1744' : phase === PHASE_SOLO ? '#FF6D00' : '#00E676';
  p.stroke(glowCol); p.strokeWeight(1);
  p.line(0, hudH, CANVAS_W, hudH);
  p.noStroke();

  const totalTiles = ROWS * COLS;
  const barX = 10, barY = 30, barW = CANVAS_W - 20, barH = 6;

  p.fill(20, 20, 30);
  p.rect(barX, barY, barW, barH, 3);

  if (phase === PHASE_COOP || phase === PHASE_SOLO) {
    const wZombie = Math.max(0, (counts.Z / totalTiles) * barW);
    const wTeam   = Math.max(0, (counts.team / totalTiles) * barW);
    if (wZombie > 0) {
      p.fill(p.color('#AA00FF'));
      p.rect(barX, barY, wZombie, barH, 3, 0, 0, 3);
    }
    if (wTeam > 0) {
      p.fill(p.color('#00E676'));
      p.rect(barX + barW - wTeam, barY, wTeam, barH, 0, 3, 3, 0);
    }
    p.textSize(9);
    p.fill('#AA00FF'); p.textAlign(p.LEFT, p.CENTER);
    p.text(`Z:${counts.Z}`, barX, 18);
    p.fill('#00E676'); p.textAlign(p.RIGHT, p.CENTER);
    p.text(`TEAM:${counts.team}`, barX + barW, 18);
  } else {
    const wA = Math.max(0, (counts.A / totalTiles) * barW);
    const wB = Math.max(0, (counts.B / totalTiles) * barW);
    if (wA > 0) {
      p.fill(p.color('#FF1744'));
      p.rect(barX, barY, wA, barH, 3, 0, 0, 3);
    }
    if (wB > 0) {
      p.fill(p.color('#00B0FF'));
      p.rect(barX + barW - wB, barY, wB, barH, 0, 3, 3, 0);
    }
    p.textSize(9);
    p.fill('#FF1744'); p.textAlign(p.LEFT, p.CENTER);
    p.text(`A:${counts.A}`, barX, 18);
    p.fill('#00B0FF'); p.textAlign(p.RIGHT, p.CENTER);
    p.text(`B:${counts.B}`, barX + barW, 18);
  }

  const timeFraction = Math.max(0, Math.min(1, timeLeft / GAME_TOTAL_TIME));
  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  p.textAlign(p.CENTER, p.CENTER);
  if (phase === PHASE_BETRAYAL) {
    const pulse = timeLeft < 10 && p.frameCount % 10 < 5;
    p.fill(pulse ? '#FF8A80' : '#FF1744');
    p.textSize(14);
    p.text(`⚠ ${timeStr} ⚠`, CANVAS_W / 2, 14);
  } else if (phase === PHASE_SOLO) {
    p.fill('#FF6D00'); p.textSize(13);
    p.text(`▶ ${timeStr}`, CANVAS_W / 2, 14);
  } else {
    p.fill('#00E676'); p.textSize(13);
    p.text(timeStr, CANVAS_W / 2, 14);
  }

  p.textSize(8); p.textAlign(p.RIGHT, p.CENTER);
  if (phase === PHASE_COOP)          { p.fill('#00E676'); p.text('[ CO-OP ]', CANVAS_W - 8, 42); }
  else if (phase === PHASE_SOLO)     { p.fill('#FF6D00'); p.text('[ SOLO ]', CANVAS_W - 8, 42); }
  else if (phase === PHASE_BETRAYAL) { p.fill('#FF1744'); p.text('[ BETRAYAL ]', CANVAS_W - 8, 42); }

  if (phase === PHASE_BETRAYAL) {
    const alpha = 60 + Math.sin(p.frameCount * 0.12) * 40;
    p.noFill(); p.stroke(255, 23, 68, alpha); p.strokeWeight(4);
    p.rect(2, 2, CANVAS_W - 4, CANVAS_H - 4, 2); p.noStroke();
  }

  _drawPlayerStatus(p, playerA, 8, hudH + 8, 'A');
  _drawPlayerStatus(p, playerB, CANVAS_W - 8, hudH + 8, 'B');

  if (zombieBloodTimer > 0) {
    p.fill('#AA00FF'); p.textSize(9); p.textAlign(p.CENTER, p.TOP);
    p.text(`◈ ZOMBIE BOOST ${Math.ceil(zombieBloodTimer / FRAME_RATE)}s`, CANVAS_W / 2, hudH + 8);
  }

  _drawNotifications(p);
  p.pop();
}

function _drawPlayerStatus(p, player, x, y, label) {
  if (!player) return;
  const col = label === 'A' ? '#FF1744' : '#00B0FF';
  const icons = [];
  if (player.boostTimer > 0)     icons.push(`⚡${Math.ceil(player.boostTimer / FRAME_RATE)}`);
  if (player.steelTailTimer > 0) icons.push(`◆${Math.ceil(player.steelTailTimer / FRAME_RATE)}`);

  p.textFont('Share Tech Mono');
  p.textSize(9); p.noStroke();
  p.fill(col);
  p.textAlign(label === 'A' ? p.LEFT : p.RIGHT, p.TOP);
  const statusIcon = !player.alive ? '✖' : '●';
  p.text(`P${label} ${statusIcon} ${icons.join(' ')}`, x, y);
}

function _drawNotifications(p) {
  p.textFont('Share Tech Mono');
  for (let i = notifications.length - 1; i >= 0; i--) {
    const n = notifications[i];
    if (betrayalAnnounceFade <= 0) n.timer--;
    if (n.timer <= 0) { notifications.splice(i, 1); continue; }
    const alpha = Math.min(255, n.timer * 3);
    const yPos = CANVAS_H - 28 - (notifications.length - 1 - i) * 22;

    p.noStroke(); p.fill(0, 0, 0, alpha * 0.85);
    p.rect(8, yPos - 9, CANVAS_W - 16, 18, 3);

    const c = p.color(n.color);
    p.fill(p.red(c), p.green(c), p.blue(c), alpha);
    p.rect(8, yPos - 9, 3, 18, 1);

    p.textSize(10); p.textAlign(p.CENTER, p.CENTER);
    p.text(n.msg, CANVAS_W / 2, yPos);
  }
}
