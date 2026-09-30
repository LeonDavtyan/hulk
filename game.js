(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const playButton = document.getElementById("playButton");
  const soundButton = document.getElementById("soundButton");
  const sunCount = document.getElementById("sunCount");
  const heartsEl = document.getElementById("hearts");
  const powerPill = document.getElementById("powerPill");
  const toastEl = document.getElementById("toast");

  const W = 960;
  const H = 540;
  const WORLD_END = 5400;
  const GRAVITY = 1750;
  const keys = { left: false, right: false, jump: false };
  const platforms = [
    { x: -100, y: 461, w: 700 },
    { x: 680, y: 461, w: 585 },
    { x: 1350, y: 461, w: 565 },
    { x: 1995, y: 461, w: 575 },
    { x: 2655, y: 461, w: 565 },
    { x: 3305, y: 461, w: 565 },
    { x: 3955, y: 461, w: 575 },
    { x: 4615, y: 461, w: 785 },
    { x: 300, y: 390, w: 150, raised: true },
    { x: 880, y: 384, w: 160, raised: true },
    { x: 1525, y: 382, w: 175, raised: true },
    { x: 2170, y: 385, w: 170, raised: true },
    { x: 2820, y: 380, w: 160, raised: true },
    { x: 3470, y: 382, w: 165, raised: true },
    { x: 4140, y: 380, w: 160, raised: true },
    { x: 4770, y: 384, w: 170, raised: true },
  ];

  const sunPositions = [
    [170, 420], [350, 344], [525, 420],
    [765, 420], [955, 340], [1150, 420],
    [1430, 420], [1615, 337], [1810, 420],
    [2075, 420], [2255, 340], [2450, 420],
    [2735, 420], [2905, 335], [3110, 420],
    [3395, 420], [3555, 337], [3770, 420],
    [4050, 420], [4225, 335], [4430, 420],
    [4720, 420], [4855, 339], [5080, 420],
  ];
  const itemPositions = [
    { kind: "mushroom", x: 805, y: 431 },
    { kind: "star", x: 1770, y: 421 },
    { kind: "mushroom", x: 2740, y: 431 },
    { kind: "star", x: 3670, y: 421 },
    { kind: "mushroom", x: 4705, y: 431 },
  ];
  const enemyPositions = [1110, 1860, 2440, 3150, 3790, 4450, 4990];

  let state = "intro";
  let player;
  let suns;
  let items;
  let enemies;
  let particles = [];
  let cameraX = 0;
  let time = 0;
  let lastTime = 0;
  let accumulator = 0;
  let toastTimer = 0;
  let audioContext = null;
  let soundOn = true;
  let shownPowerSecond = 0;

  function reset() {
    player = {
      x: 70, y: 403, w: 42, h: 58, vx: 0, vy: 0,
      hearts: 3, sunCount: 0, grown: false, strongTime: 0,
      invincible: 0, coyote: 0, jumpBuffer: 0, facing: 1,
      checkpoint: 0, grounded: true,
    };
    suns = sunPositions.map(([x, y]) => ({ x, y, taken: false }));
    items = itemPositions.map(item => ({ ...item, taken: false }));
    enemies = enemyPositions.map((x, index) => ({ x, home: x, y: 434, dir: index % 2 ? -1 : 1, alive: true }));
    particles = [];
    cameraX = 0;
    time = 0;
    shownPowerSecond = 0;
    updateHud();
  }

  function updateHud() {
    sunCount.textContent = player.sunCount;
    heartsEl.textContent = "♥ ".repeat(player.hearts) + "♡ ".repeat(3 - player.hearts);
    heartsEl.setAttribute("aria-label", `${player.hearts} hearts remaining`);
    powerPill.textContent = player.strongTime > 0
      ? `✦ SUPER STRONG ${Math.ceil(player.strongTime)}s`
      : player.grown ? "🍄 BIG HULK" : "✦ Ready for adventure";
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    toastTimer = 2.2;
  }

  function tone(frequency, duration = .12, type = "sine", volume = .08) {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) { /* Audio is optional. */ }
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * .35;
      const speed = 70 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 50, life: .6 + Math.random() * .3, color, size: 3 + Math.random() * 4 });
    }
  }

  function setSize(grown) {
    if (player.grown === grown) return;
    const bottom = player.y + player.h;
    const center = player.x + player.w / 2;
    player.grown = grown;
    player.w = grown ? 57 : 42;
    player.h = grown ? 78 : 58;
    player.x = center - player.w / 2;
    player.y = bottom - player.h;
  }

  function start() {
    reset();
    state = "playing";
    overlay.classList.add("hidden");
    tone(520, .12); setTimeout(() => tone(780, .2), 110);
  }

  function finish(won) {
    state = won ? "won" : "lost";
    overlayTitle.innerHTML = won ? "You did it!<br><em>Sky hero!</em>" : "Try again,<br><em>sky hero!</em>";
    overlayText.textContent = won
      ? `Golden Hulk reached the rainbow gate with ${player.sunCount} suns. What a bright adventure!`
      : `You collected ${player.sunCount} suns. Take a breath and give the clouds another try!`;
    playButton.innerHTML = won ? "Play again <span>➜</span>" : "Try again <span>➜</span>";
    overlay.classList.remove("hidden");
    tone(won ? 880 : 270, .35, won ? "sine" : "triangle");
  }

  function hurt() {
    if (player.invincible > 0 || state !== "playing") return;
    player.hearts--;
    burst(player.x + player.w / 2, player.y + player.h / 2, "#ee7658", 14);
    tone(190, .25, "sawtooth", .045);
    if (player.grown) setSize(false);
    updateHud();
    if (player.hearts <= 0) {
      finish(false);
      return;
    }
    player.x = platforms[player.checkpoint].x + 75;
    player.y = platforms[player.checkpoint].y - player.h;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 2;
    showToast("Oof! Try that jump again!");
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    time += dt;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove("show");
    }
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    if (state !== "playing") return;

    player.invincible = Math.max(0, player.invincible - dt);
    player.strongTime = Math.max(0, player.strongTime - dt);
    if (Math.ceil(player.strongTime) !== shownPowerSecond) {
      shownPowerSecond = Math.ceil(player.strongTime);
      updateHud();
    }
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.coyote = player.grounded ? .11 : Math.max(0, player.coyote - dt);
    const input = Number(keys.right) - Number(keys.left);
    player.vx = input * (player.strongTime > 0 ? 330 : 275);
    if (input) player.facing = input;
    if (player.jumpBuffer > 0 && player.coyote > 0) {
      player.vy = player.grown ? -690 : -645;
      if (player.strongTime > 0) player.vy -= 45;
      player.grounded = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      tone(430, .11, "triangle", .07);
    }

    const oldBottom = player.y + player.h;
    player.x = Math.max(-5, Math.min(WORLD_END - player.w, player.x + player.vx * dt));
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    player.grounded = false;
    if (player.vy >= 0) {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (oldBottom <= p.y + 7 && player.y + player.h >= p.y && player.x + player.w > p.x + 5 && player.x < p.x + p.w - 5) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.grounded = true;
          if (i < 8) player.checkpoint = i;
          break;
        }
      }
    }
    if (player.y > H + 90) hurt();
    if (state !== "playing") return;

    const centerX = player.x + player.w / 2;
    const centerY = player.y + player.h / 2;
    for (const sun of suns) {
      if (!sun.taken && Math.hypot(centerX - sun.x, centerY - sun.y) < (player.grown ? 44 : 34)) {
        sun.taken = true;
        player.sunCount++;
        burst(sun.x, sun.y, "#ffc32b", 8);
        tone(650 + (player.sunCount % 5) * 90, .1);
        updateHud();
      }
    }
    for (const item of items) {
      if (item.taken || Math.hypot(centerX - item.x, centerY - item.y) > 39) continue;
      item.taken = true;
      if (item.kind === "mushroom") {
        setSize(true);
        showToast("Mushroom power! BIG HULK!");
        burst(item.x, item.y, "#f17850", 16);
        tone(550, .18); setTimeout(() => tone(750, .25), 110);
      } else {
        player.strongTime = 12;
        showToast("STAR POWER! Bump storm clouds!");
        burst(item.x, item.y, "#ffce34", 18);
        tone(740, .18); setTimeout(() => tone(990, .25), 100);
      }
      updateHud();
    }
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.dir * 37 * dt;
      if (Math.abs(enemy.x - enemy.home) > 34) enemy.dir *= -1;
      if (overlap(player, { x: enemy.x - 22, y: enemy.y - 21, w: 44, h: 38 })) {
        if (player.strongTime > 0) {
          enemy.alive = false;
          burst(enemy.x, enemy.y, "#9d83b9", 18);
          showToast("Storm cloud, be gone!");
          tone(190, .09, "triangle"); setTimeout(() => tone(390, .16), 75);
        } else {
          hurt();
          break;
        }
      }
    }
    if (player.x > 5200) {
      if (player.sunCount >= 12) finish(true);
      else if (toastTimer <= 0) showToast(`Find ${12 - player.sunCount} more suns to open the gate!`);
    }
    cameraX += (Math.max(0, Math.min(WORLD_END - W, player.x - W * .32)) - cameraX) * Math.min(1, dt * 5);
  }

  function roundedRect(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function cloud(x, y, scale, color = "#fff9e7") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 45 * scale, 17 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 22 * scale, y - 9 * scale, 22 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 4 * scale, y - 17 * scale, 29 * scale, 25 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 31 * scale, y - 7 * scale, 20 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function starPath(x, y, outer, inner, points = 5) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + i * Math.PI / points;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#ffd76d");
    gradient.addColorStop(.54, "#ffecaa");
    gradient.addColorStop(1, "#fff7d3");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    const sunX = 780 - cameraX * .025;
    const glow = ctx.createRadialGradient(sunX, 115, 20, sunX, 115, 190);
    glow.addColorStop(0, "#fffce1bb"); glow.addColorStop(1, "#fffce100");
    ctx.fillStyle = glow; ctx.fillRect(sunX - 200, -90, 400, 400);
    ctx.fillStyle = "#fff7d8";
    ctx.beginPath(); ctx.arc(sunX, 115, 57, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffdc74";
    ctx.beginPath(); ctx.arc(sunX, 115, 40, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 24; i++) {
      const x = ((i * 285 + 90 - cameraX * .17) % 1250 + 1250) % 1250 - 110;
      const y = 102 + (i * 83) % 210;
      cloud(x, y, .48 + (i % 3) * .18, "#fff8dba8");
    }
    for (let i = 0; i < 17; i++) {
      const x = ((i * 370 - cameraX * .36) % 1450 + 1450) % 1450 - 130;
      cloud(x, 475 + (i % 3) * 16, 1.7, "#fffdf0a8");
    }
    ctx.fillStyle = "#fff7d7";
    for (let i = 0; i < 34; i++) {
      const x = ((i * 191 + 43 - cameraX * .21) % 1100 + 1100) % 1100;
      const y = 80 + (i * 73) % 280;
      const r = i % 3 === 0 ? 3 : 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlatform(p) {
    const x = p.x - cameraX;
    if (x > W + 70 || x + p.w < -70) return;
    roundedRect(x + 8, p.y + 12, p.w - 16, 28, 14, "#e6bf77");
    roundedRect(x, p.y + 5, p.w, 27, 16, "#f6dfaa");
    roundedRect(x, p.y - 3, p.w, 25, 16, "#fffdf0");
    for (let cx = x + 30; cx < x + p.w - 15; cx += 70) {
      ctx.fillStyle = "#fffdf0";
      ctx.beginPath();
      ctx.arc(cx, p.y - 8, 20, Math.PI, 0);
      ctx.arc(cx + 30, p.y - 6, 25, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = "#f7d795";
    for (let cx = x + 44; cx < x + p.w - 10; cx += 130) {
      ctx.beginPath(); ctx.arc(cx, p.y + 24, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSun(sun) {
    if (sun.taken) return;
    const x = sun.x - cameraX;
    if (x < -30 || x > W + 30) return;
    const y = sun.y + Math.sin(time * 4 + sun.x) * 3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * .45);
    ctx.fillStyle = "#fff3a9"; starPath(0, 0, 20, 14, 8); ctx.fill();
    ctx.fillStyle = "#f7b51c"; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff2a0"; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawItem(item) {
    if (item.taken) return;
    const x = item.x - cameraX;
    if (x < -40 || x > W + 40) return;
    const y = item.y + Math.sin(time * 3 + item.x) * 4;
    ctx.save(); ctx.translate(x, y);
    if (item.kind === "star") {
      ctx.rotate(Math.sin(time * 3) * .12);
      ctx.shadowColor = "#ffdd4b"; ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffcc37"; starPath(0, 0, 23, 11); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff4b4"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#9a5b28";
      ctx.beginPath(); ctx.arc(-6, -1, 1.6, 0, 7); ctx.arc(6, -1, 1.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 4, 4, 0, Math.PI); ctx.strokeStyle = "#9a5b28"; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      roundedRect(-8, -1, 16, 17, 4, "#fff6d5");
      ctx.fillStyle = "#ed7351";
      ctx.beginPath(); ctx.ellipse(0, -4, 20, 13, 0, Math.PI, 0); ctx.lineTo(-20, -4); ctx.fill();
      ctx.fillStyle = "#fff8dc";
      for (const [sx, sy, r] of [[-10, -11, 4], [2, -17, 4], [12, -9, 3]]) {
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "#a05f31";
      ctx.fillRect(-4, 4, 2, 3); ctx.fillRect(4, 4, 2, 3);
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    if (!enemy.alive) return;
    const x = enemy.x - cameraX;
    if (x < -50 || x > W + 50) return;
    const y = enemy.y + Math.sin(time * 3 + enemy.home) * 3;
    cloud(x, y, .43, "#a18ab4");
    ctx.fillStyle = "#6f557e";
    ctx.beginPath(); ctx.arc(x - 7, y - 5, 2.2, 0, 7); ctx.arc(x + 7, y - 5, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = "#6f557e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 4, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.fillStyle = "#f7d76d";
    ctx.beginPath(); ctx.moveTo(x - 7, y + 17); ctx.lineTo(x - 1, y + 13); ctx.lineTo(x - 4, y + 23); ctx.closePath(); ctx.fill();
  }

  function drawHero() {
    if (player.invincible > 0 && Math.floor(time * 12) % 2 === 0) return;
    const x = player.x - cameraX + player.w / 2;
    const y = player.y + player.h;
    const scale = player.grown ? 1.36 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(player.facing * scale, scale);
    if (player.strongTime > 0) {
      ctx.strokeStyle = `rgba(255, 242, 103, ${.55 + Math.sin(time * 14) * .25})`;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0, -31, 26, 37, 0, 0, 7); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const angle = time * 2 + i * Math.PI * 2 / 5;
        ctx.fillStyle = "#fff09c";
        starPath(Math.cos(angle) * 30, -31 + Math.sin(angle) * 40, 5, 2); ctx.fill();
      }
    }
    const run = player.grounded && Math.abs(player.vx) > 0 ? Math.sin(time * 16) * 5 : 0;
    roundedRect(-16, -12 + run, 13, 12 - Math.min(run, 0), 4, "#a35d2a");
    roundedRect(3, -12 - run, 13, 12 + Math.max(run, 0), 4, "#a35d2a");
    roundedRect(-18, -29, 36, 23, 7, "#7c5ac3");
    roundedRect(-20, -43, 40, 25, 12, "#f7bc31");
    roundedRect(-25, -39 + run * .3, 11, 25, 6, "#eaa42a");
    roundedRect(14, -39 - run * .3, 11, 25, 6, "#eaa42a");
    roundedRect(-26, -20 + run * .3, 13, 10, 5, "#ffc946");
    roundedRect(13, -20 - run * .3, 13, 10, 5, "#ffc946");
    ctx.fillStyle = "#ffd052";
    ctx.beginPath(); ctx.ellipse(0, -48, 18, 17, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ce4e2f";
    ctx.beginPath();
    ctx.moveTo(-18, -52); ctx.lineTo(-19, -65); ctx.lineTo(-9, -59); ctx.lineTo(-6, -70);
    ctx.lineTo(3, -61); ctx.lineTo(10, -68); ctx.lineTo(19, -55); ctx.lineTo(13, -58);
    ctx.quadraticCurveTo(-2, -55, -18, -52); ctx.fill();
    ctx.fillStyle = "#8c4a23";
    ctx.beginPath(); ctx.arc(-6, -48, 1.7, 0, 7); ctx.arc(6, -48, 1.7, 0, 7); ctx.fill();
    ctx.strokeStyle = "#a95d27"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, -43, 5, .12, Math.PI - .12); ctx.stroke();
    ctx.fillStyle = "#e79d2b";
    ctx.beginPath(); ctx.ellipse(-18, -46, 3, 5, 0, 0, 7); ctx.ellipse(18, -46, 3, 5, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawGate() {
    const x = 5230 - cameraX;
    if (x < -100 || x > W + 120) return;
    ctx.save(); ctx.translate(x, 459);
    const colors = ["#ed7755", "#f7aa47", "#f5d967", "#97c783", "#8ab9d6", "#b49acb"];
    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i]; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, 0, 85 - i * 8, Math.PI, 0); ctx.stroke();
    }
    cloud(-72, 0, .55); cloud(72, 0, .55);
    ctx.fillStyle = "#a95632";
    ctx.font = "bold 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(player.sunCount >= 12 ? "FINISH!" : "12 SUNS", 0, -101);
    ctx.restore();
  }

  function draw() {
    drawBackground();
    for (const p of platforms) drawPlatform(p);
    drawGate();
    for (const sun of suns) drawSun(sun);
    for (const item of items) drawItem(item);
    for (const enemy of enemies) drawEnemy(enemy);
    drawHero();
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (state === "intro") {
      ctx.fillStyle = "#a56b32";
      ctx.font = "bold 17px Trebuchet MS, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("☀  SKY MEADOW", 45, 348);
    }
  }

  function frame(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000 || 0, .05);
    lastTime = timestamp;
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      update(1 / 60);
      accumulator -= 1 / 60;
    }
    draw();
    requestAnimationFrame(frame);
  }

  function setControl(name, down) {
    if (name === "jump" && down && !keys.jump) player.jumpBuffer = .14;
    keys[name] = down;
  }
  const keyMap = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "jump", KeyW: "jump", Space: "jump" };
  window.addEventListener("keydown", event => {
    if (event.code === "KeyR") { start(); return; }
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    if (state !== "playing") {
      if (event.code === "Space" || event.code === "Enter") start();
      return;
    }
    setControl(control, true);
  });
  window.addEventListener("keyup", event => {
    const control = keyMap[event.code];
    if (control) { event.preventDefault(); setControl(control, false); }
  });
  window.addEventListener("blur", () => {
    keys.left = keys.right = keys.jump = false;
  });
  for (const button of document.querySelectorAll("[data-control]")) {
    const control = button.dataset.control;
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (state !== "playing") start();
      setControl(control, true);
      button.classList.add("pressed");
    });
    const release = event => {
      event.preventDefault();
      setControl(control, false);
      button.classList.remove("pressed");
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }
  playButton.addEventListener("click", start);
  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? "♪" : "×";
    soundButton.setAttribute("aria-label", soundOn ? "Mute sound" : "Unmute sound");
  });

  reset();
  requestAnimationFrame(frame);
})();
