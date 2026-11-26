/**
 * Roguelike 2D Survival Game - Core Engine
 * Vampire Survivors / Magic Survival Style
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const killCountEl = document.getElementById('killCount');
const survivalTimeEl = document.getElementById('survivalTime');
const playerHPEl = document.getElementById('playerHP');
const expFillEl = document.getElementById('expFill');
const levelTextEl = document.getElementById('levelText');
const levelUpModal = document.getElementById('levelUpModal') || document.getElementById('level-up-modal');
const upgradeCardsEl = document.getElementById('upgradeCards');
const gameOverModal = document.getElementById('gameOverModal') || document.getElementById('game-over-modal');
const gameOverStatsEl = document.getElementById('gameOverStats');
const btnRestart = document.getElementById('btnRestart');

// Joystick Elements
const joystickZone = document.getElementById('joystick-zone');
const joyBase = document.getElementById('joyBase');
const joyThumb = document.getElementById('joyThumb');

// Screen dimension handling
let width = (canvas.width = window.innerWidth);
let height = (canvas.height = window.innerHeight);

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

// Sound Generator using Web Audio API (No external sound files required)
class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playShoot() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }
  playHit() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {}
  }
  playGem() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {}
  }
  playLevelUp() {
    if (!this.ctx) return;
    try {
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.08);
        osc.stop(this.ctx.currentTime + i * 0.08 + 0.2);
      });
    } catch (e) {}
  }
}
const sfx = new SoundFX();

// Game State
const GAME_STATE = {
  isPaused: false,
  isGameOver: false,
  gameTime: 0,
  kills: 0,
};

// Player Class
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.color = '#66fcf1';
    this.maxHp = 100;
    this.hp = 100;
    this.speed = 210;
    this.level = 1;
    this.exp = 0;
    this.expNeeded = 10;
    this.pickupRadius = 90;
    this.invulnerableTimer = 0;
    
    // Weapons & Skills Levels
    this.skills = {
      magicMissile: { level: 1, cooldown: 0.8, timer: 0, damage: 25, speed: 450, count: 1 },
      orbitShield: { level: 0, count: 2, radius: 65, speed: 3.5, angle: 0, damage: 15 },
      lightningStrike: { level: 0, cooldown: 2.2, timer: 0, damage: 60, targets: 1 },
      holyAura: { level: 0, radius: 85, tickInterval: 0.5, timer: 0, damage: 12 },
      speedBoost: { level: 0 },
      vitality: { level: 0 }
    };
  }

  update(dt, inputDir) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    // Movement
    if (inputDir.x !== 0 || inputDir.y !== 0) {
      const len = Math.hypot(inputDir.x, inputDir.y);
      const nx = inputDir.x / len;
      const ny = inputDir.y / len;
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * dt;
    }

    // Update Skills
    this.updateWeapons(dt);
  }

  takeDamage(amount) {
    if (this.invulnerableTimer > 0) return;
    this.hp -= amount;
    this.invulnerableTimer = 0.4; // 0.4s immunity
    sfx.playHit();
    createDamageText(this.x, this.y - 20, Math.round(amount), '#ff4d4d');

    if (this.hp <= 0) {
      this.hp = 0;
      triggerGameOver();
    }
  }

  gainExp(amount) {
    this.exp += amount;
    sfx.playGem();
    if (this.exp >= this.expNeeded) {
      this.exp -= this.expNeeded;
      this.level++;
      this.expNeeded = Math.floor(this.expNeeded * 1.45 + 5);
      sfx.playLevelUp();
      triggerLevelUp();
    }
  }

  updateWeapons(dt) {
    // 1. Magic Missile
    const mm = this.skills.magicMissile;
    if (mm.level > 0) {
      mm.timer += dt;
      if (mm.timer >= mm.cooldown) {
        mm.timer = 0;
        this.fireMagicMissiles();
      }
    }

    // 2. Orbit Shield
    const os = this.skills.orbitShield;
    if (os.level > 0) {
      os.angle += os.speed * dt;
      // Check collision with enemies
      const orbCount = os.count;
      for (let i = 0; i < orbCount; i++) {
        const a = os.angle + (i * (Math.PI * 2 / orbCount));
        const orbX = this.x + Math.cos(a) * os.radius;
        const orbY = this.y + Math.sin(a) * os.radius;
        
        for (let enemy of enemies) {
          const dist = Math.hypot(orbX - enemy.x, orbY - enemy.y);
          if (dist < 14 + enemy.radius) {
            enemy.takeDamage(os.damage * dt * 5);
          }
        }
      }
    }

    // 3. Lightning Strike
    const ls = this.skills.lightningStrike;
    if (ls.level > 0) {
      ls.timer += dt;
      if (ls.timer >= ls.cooldown) {
        ls.timer = 0;
        this.castLightning();
      }
    }

    // 4. Holy Aura
    const ha = this.skills.holyAura;
    if (ha.level > 0) {
      ha.timer += dt;
      if (ha.timer >= ha.tickInterval) {
        ha.timer = 0;
        for (let enemy of enemies) {
          const d = Math.hypot(this.x - enemy.x, this.y - enemy.y);
          if (d <= ha.radius + enemy.radius) {
            enemy.takeDamage(ha.damage);
            createSparkEffect(enemy.x, enemy.y, '#ffd700');
          }
        }
      }
    }
  }

  fireMagicMissiles() {
    if (enemies.length === 0) return;
    const count = this.skills.magicMissile.count;
    
    // Sort enemies by closest
    const sorted = [...enemies].sort((a, b) => {
      const d1 = Math.hypot(this.x - a.x, this.y - a.y);
      const d2 = Math.hypot(this.x - b.x, this.y - b.y);
      return d1 - d2;
    });

    for (let i = 0; i < count; i++) {
      const target = sorted[i % sorted.length];
      if (!target) break;
      const angle = Math.atan2(target.y - this.y, target.x - this.x) + (Math.random() - 0.5) * 0.2;
      projectiles.push(new Projectile(
        this.x, this.y, 
        Math.cos(angle) * this.skills.magicMissile.speed, 
        Math.sin(angle) * this.skills.magicMissile.speed, 
        this.skills.magicMissile.damage,
        '#00f0ff'
      ));
      sfx.playShoot();
    }
  }

  castLightning() {
    if (enemies.length === 0) return;
    const count = this.skills.lightningStrike.targets;
    const sorted = [...enemies].sort((a, b) => {
      const d1 = Math.hypot(this.x - a.x, this.y - a.y);
      const d2 = Math.hypot(this.x - b.x, this.y - b.y);
      return d1 - d2;
    });

    for (let i = 0; i < count && i < sorted.length; i++) {
      const target = sorted[i];
      target.takeDamage(this.skills.lightningStrike.damage);
      lightningRays.push({
        x1: target.x,
        y1: target.y - 400,
        x2: target.x,
        y2: target.y,
        life: 0.18
      });
      createSparkEffect(target.x, target.y, '#f5ee38');
    }
    sfx.playHit();
  }

  draw(ctx, camX, camY) {
    const screenX = this.x - camX;
    const screenY = this.y - camY;

    // Holy Aura indicator
    if (this.skills.holyAura.level > 0) {
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.skills.holyAura.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 230, 100, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Orbit Shields
    if (this.skills.orbitShield.level > 0) {
      const os = this.skills.orbitShield;
      for (let i = 0; i < os.count; i++) {
        const a = os.angle + (i * (Math.PI * 2 / os.count));
        const ox = screenX + Math.cos(a) * os.radius;
        const oy = screenY + Math.sin(a) * os.radius;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(ox, oy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ff007f';
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }
    }

    // Invulnerability flashing
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      return;
    }

    // Hero Character Body
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // HP Mini Bar over Head
    const barW = 34;
    const barH = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(screenX - barW / 2, screenY - this.radius - 12, barW, barH);
    ctx.fillStyle = '#00ff88';
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillRect(screenX - barW / 2, screenY - this.radius - 12, barW * hpRatio, barH);
  }
}

// Projectile Class
class Projectile {
  constructor(x, y, vx, vy, damage, color = '#00f0ff') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.color = color;
    this.radius = 5;
    this.life = 2.5;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Enemy Class
class Enemy {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.type = type;

    if (type === 'fast') {
      this.radius = 12;
      this.speed = 135;
      this.maxHp = 35;
      this.hp = 35;
      this.damage = 10;
      this.color = '#ff9900';
      this.expVal = 2;
    } else if (type === 'brute') {
      this.radius = 24;
      this.speed = 65;
      this.maxHp = 180;
      this.hp = 180;
      this.damage = 25;
      this.color = '#a0153e';
      this.expVal = 6;
    } else { // normal zombie/bat
      this.radius = 14;
      this.speed = 95;
      this.maxHp = 50;
      this.hp = 50;
      this.damage = 14;
      this.color = '#e63946';
      this.expVal = 1;
    }
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    // Touch player
    if (dist < this.radius + player.radius) {
      player.takeDamage(this.damage);
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    createDamageText(this.x, this.y - 12, Math.round(amount), '#ffffff');
    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.dead = true;
    GAME_STATE.kills++;
    gems.push(new ExpGem(this.x, this.y, this.expVal));
    createDeathEffect(this.x, this.y, this.color);
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;

    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx - this.radius * 0.35, sy - 2, 3, 0, Math.PI * 2);
    ctx.arc(sx + this.radius * 0.35, sy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Exp Gem Class
class ExpGem {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = 6;
    this.color = value > 2 ? '#ff00ff' : '#00e5ff';
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < player.pickupRadius) {
      const speed = 400 + (player.pickupRadius - dist) * 4;
      this.x += (dx / dist) * speed * dt;
      this.y += (dy / dist) * speed * dt;

      if (dist < player.radius + this.radius) {
        player.gainExp(this.value);
        this.collected = true;
      }
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Particle & Floating text effects
const particles = [];
const damageTexts = [];
const lightningRays = [];

function createDamageText(x, y, text, color) {
  damageTexts.push({ x, y, text, color, life: 0.6, vy: -40 });
}

function createDeathEffect(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 80;
    particles.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      radius: 3 + Math.random() * 3,
      color,
      life: 0.4
    });
  }
}

function createSparkEffect(x, y, color) {
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 60;
    particles.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      radius: 2.5,
      color,
      life: 0.3
    });
  }
}

// Global Collections
let player;
let enemies = [];
let projectiles = [];
let gems = [];
let spawnTimer = 0;

// Input Handling
const keys = {};
window.addEventListener('keydown', (e) => {
  sfx.init();
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Touch / Joystick Handling
let touchStartPos = null;
let touchCurrentPos = null;
let joystickDir = { x: 0, y: 0 };

joystickZone.addEventListener('touchstart', (e) => {
  sfx.init();
  const t = e.touches[0];
  touchStartPos = { x: t.clientX, y: t.clientY };
  touchCurrentPos = { x: t.clientX, y: t.clientY };
  
  joyBase.style.display = 'block';
  joyThumb.style.display = 'block';
  joyBase.style.left = `${touchStartPos.x}px`;
  joyBase.style.top = `${touchStartPos.y}px`;
  joyThumb.style.left = `${touchStartPos.x}px`;
  joyThumb.style.top = `${touchStartPos.y}px`;
}, { passive: false });

joystickZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!touchStartPos) return;
  const t = e.touches[0];
  touchCurrentPos = { x: t.clientX, y: t.clientY };

  const dx = touchCurrentPos.x - touchStartPos.x;
  const dy = touchCurrentPos.y - touchStartPos.y;
  const dist = Math.hypot(dx, dy);
  const maxRadius = 55;

  if (dist > 0) {
    const clampedDist = Math.min(dist, maxRadius);
    const nx = dx / dist;
    const ny = dy / dist;
    joystickDir = { x: nx * (clampedDist / maxRadius), y: ny * (clampedDist / maxRadius) };
    joyThumb.style.left = `${touchStartPos.x + nx * clampedDist}px`;
    joyThumb.style.top = `${touchStartPos.y + ny * clampedDist}px`;
  }
}, { passive: false });

function endTouch() {
  touchStartPos = null;
  touchCurrentPos = null;
  joystickDir = { x: 0, y: 0 };
  joyBase.style.display = 'none';
  joyThumb.style.display = 'none';
}

joystickZone.addEventListener('touchend', endTouch);
joystickZone.addEventListener('touchcancel', endTouch);

// Mouse drag fallback for testing joystick with mouse
let isMouseDown = false;
joystickZone.addEventListener('mousedown', (e) => {
  sfx.init();
  isMouseDown = true;
  touchStartPos = { x: e.clientX, y: e.clientY };
  joyBase.style.display = 'block';
  joyThumb.style.display = 'block';
  joyBase.style.left = `${e.clientX}px`;
  joyBase.style.top = `${e.clientY}px`;
  joyThumb.style.left = `${e.clientX}px`;
  joyThumb.style.top = `${e.clientY}px`;
});
window.addEventListener('mousemove', (e) => {
  if (!isMouseDown || !touchStartPos) return;
  const dx = e.clientX - touchStartPos.x;
  const dy = e.clientY - touchStartPos.y;
  const dist = Math.hypot(dx, dy);
  const maxRadius = 55;
  if (dist > 0) {
    const clampedDist = Math.min(dist, maxRadius);
    const nx = dx / dist;
    const ny = dy / dist;
    joystickDir = { x: nx * (clampedDist / maxRadius), y: ny * (clampedDist / maxRadius) };
    joyThumb.style.left = `${touchStartPos.x + nx * clampedDist}px`;
    joyThumb.style.top = `${touchStartPos.y + ny * clampedDist}px`;
  }
});
window.addEventListener('mouseup', () => {
  if (isMouseDown) {
    isMouseDown = false;
    endTouch();
  }
});

// Upgrade Pool Definition
const UPGRADE_POOL = [
  {
    id: 'missile_count',
    name: 'Tên Lửa Phép (+1)',
    icon: '🔮',
    desc: 'Tăng thêm 1 viên đạn bắn cùng lúc vào kẻ thù gần nhất.',
    apply: (p) => {
      p.skills.magicMissile.count += 1;
      p.skills.magicMissile.damage += 6;
    }
  },
  {
    id: 'missile_speed',
    name: 'Tốc Phép',
    icon: '⚡',
    desc: 'Giảm 25% thời gian hồi chiêu của Tên Lửa Phép.',
    apply: (p) => {
      p.skills.magicMissile.cooldown = Math.max(0.25, p.skills.magicMissile.cooldown * 0.75);
    }
  },
  {
    id: 'orbit_shield',
    name: 'Vòng Hộ Vệ',
    icon: '🛡️',
    desc: 'Tạo quả cầu năng lượng xoay quanh người gây sát thương liên tục.',
    apply: (p) => {
      p.skills.orbitShield.level += 1;
      p.skills.orbitShield.count += 1;
      p.skills.orbitShield.damage += 8;
    }
  },
  {
    id: 'lightning',
    name: 'Sấm Sét Hủy Diệt',
    icon: '🌩️',
    desc: 'Đánh sét ngẫu nhiên từ trên trời xuống kẻ thù gây sát thương lớn.',
    apply: (p) => {
      p.skills.lightningStrike.level += 1;
      p.skills.lightningStrike.targets += 1;
      p.skills.lightningStrike.damage += 25;
    }
  },
  {
    id: 'holy_aura',
    name: 'Hào Quang Thánh',
    icon: '☀️',
    desc: 'Vùng ánh sáng quanh bạn liên tục thiêu đốt mọi quái lại gần.',
    apply: (p) => {
      p.skills.holyAura.level += 1;
      p.skills.holyAura.radius += 20;
      p.skills.holyAura.damage += 6;
    }
  },
  {
    id: 'move_speed',
    name: 'Giày Thần Tốc',
    icon: '👟',
    desc: 'Tăng 20% tốc độ di chuyển của nhân vật.',
    apply: (p) => {
      p.skills.speedBoost.level += 1;
      p.speed *= 1.2;
    }
  },
  {
    id: 'vitality',
    name: 'Máu & Hồi Máu',
    icon: '💖',
    desc: 'Tăng +40 Máu tối đa và hồi đầy thanh máu ngay lập tức.',
    apply: (p) => {
      p.skills.vitality.level += 1;
      p.maxHp += 40;
      p.hp = p.maxHp;
    }
  },
  {
    id: 'magnet',
    name: 'Nam Châm Hút Ngọc',
    icon: '🧲',
    desc: 'Mở rộng gấp đôi phạm vi hút ngọc kinh nghiệm rơi trên bản đồ.',
    apply: (p) => {
      p.pickupRadius += 80;
    }
  }
];

function triggerLevelUp() {
  GAME_STATE.isPaused = true;
  levelUpModal.classList.add('active');
  upgradeCardsEl.innerHTML = '';

  // Pick 3 random distinct upgrades
  const shuffled = [...UPGRADE_POOL].sort(() => 0.5 - Math.random());
  const options = shuffled.slice(0, 3);

  options.forEach((opt) => {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
      <div class="card-icon">${opt.icon}</div>
      <div class="card-info">
        <div class="card-name">${opt.name}</div>
        <div class="card-desc">${opt.desc}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      opt.apply(player);
      levelUpModal.classList.remove('active');
      GAME_STATE.isPaused = false;
    });
    upgradeCardsEl.appendChild(card);
  });
}

function triggerGameOver() {
  GAME_STATE.isGameOver = true;
  gameOverModal.classList.add('active');
  const minutes = Math.floor(GAME_STATE.gameTime / 60);
  const seconds = Math.floor(GAME_STATE.gameTime % 60);
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  gameOverStatsEl.innerHTML = `
    ⏱️ Thời gian sinh tồn: <b>${timeFormatted}</b><br>
    ⚔️ Số quái tiêu diệt: <b>${GAME_STATE.kills}</b><br>
    🌟 Cấp độ đạt được: <b>${player.level}</b>
  `;
}

btnRestart.addEventListener('click', () => {
  resetGame();
  gameOverModal.classList.remove('active');
});

function resetGame() {
  player = new Player(0, 0);
  enemies = [];
  projectiles = [];
  gems = [];
  particles.length = 0;
  damageTexts.length = 0;
  lightningRays.length = 0;
  spawnTimer = 0;
  GAME_STATE.gameTime = 0;
  GAME_STATE.kills = 0;
  GAME_STATE.isGameOver = false;
  GAME_STATE.isPaused = false;
}

// Spawner logic
function updateEnemySpawn(dt) {
  spawnTimer += dt;
  // Dynamic spawn rate: increases over time
  const interval = Math.max(0.18, 1.2 - (GAME_STATE.gameTime / 180));
  
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    
    // Spawn at random position around player outside screen
    const spawnDist = Math.max(width, height) * 0.65;
    const angle = Math.random() * Math.PI * 2;
    const sx = player.x + Math.cos(angle) * spawnDist;
    const sy = player.y + Math.sin(angle) * spawnDist;

    // Pick type based on time
    let type = 'normal';
    const roll = Math.random();
    if (GAME_STATE.gameTime > 60 && roll < 0.25) {
      type = 'brute';
    } else if (GAME_STATE.gameTime > 30 && roll < 0.45) {
      type = 'fast';
    }

    enemies.push(new Enemy(sx, sy, type));
  }
}

// Background Grid Drawing
function drawGrid(ctx, camX, camY) {
  const gridSize = 64;
  const startX = Math.floor((camX - width / 2) / gridSize) * gridSize;
  const endX = startX + width + gridSize * 2;
  const startY = Math.floor((camY - height / 2) / gridSize) * gridSize;
  const endY = startY + height + gridSize * 2;

  ctx.strokeStyle = '#161d27';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += gridSize) {
    ctx.moveTo(x - camX, 0);
    ctx.lineTo(x - camX, height);
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.moveTo(0, y - camY);
    ctx.lineTo(width, y - camY);
  }
  ctx.stroke();
}

// Main Game Loop
let lastTime = performance.now();

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (GAME_STATE.isPaused || GAME_STATE.isGameOver) return;

  GAME_STATE.gameTime += dt;

  // Process Keyboard input
  let moveX = 0;
  let moveY = 0;
  if (keys['w'] || keys['arrowup']) moveY -= 1;
  if (keys['s'] || keys['arrowdown']) moveY += 1;
  if (keys['a'] || keys['arrowleft']) moveX -= 1;
  if (keys['d'] || keys['arrowright']) moveX += 1;

  // Combine Keyboard with Joystick
  if (joystickDir.x !== 0 || joystickDir.y !== 0) {
    moveX = joystickDir.x;
    moveY = joystickDir.y;
  }

  // Update Player
  player.update(dt, { x: moveX, y: moveY });

  // Update Spawner & Enemies
  updateEnemySpawn(dt);
  for (let enemy of enemies) {
    enemy.update(dt, player);
  }
  enemies = enemies.filter(e => !e.dead);

  // Update Projectiles & Check Collisions
  for (let p of projectiles) {
    p.update(dt);
    for (let enemy of enemies) {
      const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
      if (d < p.radius + enemy.radius) {
        enemy.takeDamage(p.damage);
        p.life = 0;
        createSparkEffect(p.x, p.y, p.color);
        break;
      }
    }
  }
  projectiles = projectiles.filter(p => p.life > 0);

  // Update Gems
  for (let gem of gems) {
    gem.update(dt, player);
  }
  gems = gems.filter(g => !g.collected);

  // Update Visual Effects
  for (let part of particles) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.life -= dt;
  }
  for (let dtText of damageTexts) {
    dtText.y += dtText.vy * dt;
    dtText.life -= dt;
  }
  for (let lr of lightningRays) {
    lr.life -= dt;
  }

  // Camera tracking player
  const camX = player.x - width / 2;
  const camY = player.y - height / 2;

  // Render Frame
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, camX, camY);

  // Draw Gems
  for (let gem of gems) gem.draw(ctx, camX, camY);

  // Draw Enemies
  for (let enemy of enemies) enemy.draw(ctx, camX, camY);

  // Draw Projectiles
  for (let p of projectiles) p.draw(ctx, camX, camY);

  // Draw Lightning
  for (let lr of lightningRays) {
    if (lr.life > 0) {
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(lr.x1 - camX, lr.y1 - camY);
      ctx.lineTo(lr.x2 - camX, lr.y2 - camY);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw Player
  player.draw(ctx, camX, camY);

  // Draw Particles
  for (let part of particles) {
    if (part.life > 0) {
      ctx.save();
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x - camX, part.y - camY, part.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw Damage Numbers
  for (let dtText of damageTexts) {
    if (dtText.life > 0) {
      ctx.save();
      ctx.fillStyle = dtText.color;
      ctx.font = 'bold 15px sans-serif';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(dtText.text, dtText.x - camX, dtText.y - camY);
      ctx.restore();
    }
  }

  // Update HUD
  killCountEl.textContent = `⚔️ ${GAME_STATE.kills}`;
  const minutes = Math.floor(GAME_STATE.gameTime / 60);
  const seconds = Math.floor(GAME_STATE.gameTime % 60);
  survivalTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  playerHPEl.textContent = `❤️ ${Math.max(0, Math.round(player.hp))}/${player.maxHp}`;
  levelTextEl.textContent = `CẤP ${player.level}`;
  const expRatio = Math.min(1, player.exp / player.expNeeded) * 100;
  expFillEl.style.width = `${expRatio}%`;
}

// Start Game
resetGame();
requestAnimationFrame(gameLoop);
