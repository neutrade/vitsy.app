/*
 * vitsy.app: the Day Arc sky (job 20261104-site-overhaul). A canvas port of the app's
 * src/features/today/arc/ambientSkyModel.ts at 4089fde2 (D1908, D1924, D1928); names as in the app. Website
 * adaptations and the rules it keeps: site/README.md "The sky". sky.test.ts pins it to the app. It draws the hero by
 * the visitor's clock, and each closing night band (job 20261104-site-sky-mobile) always at night.
 */
(() => {
'use strict';

// 1. Constants
const DAY_DOT_COUNT = 22;
const NIGHT_STAR_COUNT = 14;
const NIGHT_BIG_STARS = 3;
const AMBIENT_CLEARANCE_PT = 10;
const SKY_TOP_PT = 4;
const LOOP_S = 120;
const FRAME_MS = 1000 / 15;
const MAX_ADVANCE_MS = 100;
const DOT_Z = { min: 11.2, max: 16.9 };
const DOT_SCALE = 0.13;
const DOT_AMP_X = 16;
const DOT_AMP_Y = 9;
const DOT_F1 = { min: 0.18, max: 0.35 };
const DOT_F2 = { min: 0.22, max: 0.4 };
const DOT_SIDE_SPEED_MAX = 4.8;
const DOT_FP = { min: 0.6, max: 1.4 };
const DOT_FS = { min: 0.78, max: 1.82 };
const DOT_BX = { min: 0.04, max: 0.96 };
const STAR_Z = { min: 5, max: 10 };
const STAR_DOT_SCALE = 0.13;
const STAR_BIG_SCALE = 0.55;
const STAR_TW = { min: 1.5, max: 4 };
const STAR_X = { min: 0.06, max: 0.94 };
const STAR_V = { min: 0.06, max: 0.5 };
const GLINT_LIFE_S = 0.8;
const GLINT_SIZE = 20;
const GLINT_GAP_S = { min: 2.2, max: 4.5 };
const GLINTS_PER_LOOP = 36;
const SHOT_LIFE_S = 0.65;
const SHOT_GAP_S = { min: 20, max: 40 };
const SHOT_QUIET_S = 20;
const SHOTS_PER_LOOP = 4;
const SHOT_WIDTH = 1.6;
const SHOT_TRAIL_STEP_S = 1 / 60;
const SHOT_CLEARANCE_PT = 22;
const SHOT_VX = { min: 260, max: 330 };
const SHOT_VY = { min: 60, max: 110 };
const SHOT_ANGLE_DEG = { min: 12, max: 21 };
const SHOT_PAST_PEAK = { min: 30, max: 50 };
const TRAIL_POINTS = 16;
const TRAIL_MAX_PT = 75;
const GLINT_UNTIL_N = 0.5;
const SHOT_FROM_N = 0.8;
const SEEDS = { dots: 0x5eed11, stars: 0x5eed12, glints: 0x5eed13, shots: 0x5eed14 };
const TAU = Math.PI * 2;
const PALETTE = { day: [], glint: '', glintCore: '', star: '' };
const SKY_TIMES = { dawnFrom: 330, dawnTo: 420, duskFrom: 1170, duskTo: 1260 };

const FIELD_AREA = 37500;
const MAX_FIELDS = 8;
const WIDE_FROM_PX = 720;
const FIELD_SEED_STEP = 0x10000;
const LARGE_FROM_PX = 1024;
const LARGE_SCALE = 1.3;
const LARGE_STAR_SCALE = 1.6;
const BOX = 'figure, .button';
const SKY_CLASS = 'has-sky';
const FEATHER = 16;
const DPR_MAX = 2;
const REBUILD_MS = 150;
const CLOCK_EVERY_S = 30;
const RIBBON_D = /^M0 (-?\d+(?:\.\d+)?) Q500 (-?\d+(?:\.\d+)?) 1000 \1$/;

// 2. Model
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, range) => range.min + (range.max - range.min) * r();
function cycleRange(range) {
  return { lo: Math.ceil((range.min * LOOP_S) / TAU - 1e-9), hi: Math.floor((range.max * LOOP_S) / TAU + 1e-9) };
}
function wholeCycles(rate, range) {
  const { lo, hi } = cycleRange(range);
  const k = Math.min(hi, Math.max(lo, Math.round((rate * LOOP_S) / TAU)));
  return (k * TAU) / LOOP_S;
}
function shuffled(n, r) {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function spread(n, range, r) {
  const slots = shuffled(n, r);
  const places = slots.map((slot) => {
    const edge = slot < 2 || slot > n - 3;
    const f = Math.min(1, Math.max(0, (slot + (edge ? 0 : 0.6 * (r() - 0.5))) / (n - 1)));
    return range.min + (range.max - range.min) * f;
  });
  return { slots, places };
}
function daySeeds(seed) {
  const r = random(seed);
  const { slots, places } = spread(DAY_DOT_COUNT, DOT_BX, r);
  const fpCycles = cycleRange(DOT_FP);
  const fpOrder = shuffled(fpCycles.hi - fpCycles.lo + 1, r);
  const seeds = places.map((bx, i) => {
    const f1 = wholeCycles(between(r, DOT_F1), DOT_F1);
    const fp = ((fpCycles.lo + fpOrder[i % fpOrder.length]) * TAU) / LOOP_S;
    return {
      bx,
      v: 0.1 + 0.8 * r(),
      f1,
      f2: wholeCycles(between(r, DOT_F2), DOT_F2),
      ax: Math.min(DOT_AMP_X, DOT_SIDE_SPEED_MAX / f1),
      ay: DOT_AMP_Y,
      fp,
      fs: wholeCycles(fp * 1.3, DOT_FS),
      ph: TAU * r(),
      ph2: TAU * r(),
      z: between(r, DOT_Z),
      colour: i % 3,
    };
  });
  const at = (slot) => seeds[slots.indexOf(slot)];
  for (const [outer, inner] of [[0, 1], [DAY_DOT_COUNT - 1, DAY_DOT_COUNT - 2]]) {
    const a = at(outer);
    Object.assign(at(inner), { f1: a.f1, ax: a.ax, ph: a.ph + Math.PI });
  }
  return seeds;
}
function nightSeeds(seed) {
  const r = random(seed);
  const { places } = spread(NIGHT_STAR_COUNT, STAR_X, r);
  return places.map((bx, i) => ({
    bx,
    v: between(r, STAR_V),
    z: between(r, STAR_Z),
    big: i < NIGHT_BIG_STARS,
    tw: wholeCycles(between(r, STAR_TW), STAR_TW),
    ph: TAU * r(),
  }));
}
function loopStarts(r, n, gap, quiet, life) {
  let gaps = Array.from({ length: n }, () => between(r, gap));
  const diff = LOOP_S - gaps.reduce((a, b) => a + b, 0);
  const room = gaps.map((g) => (diff > 0 ? gap.max - g : g - gap.min));
  const total = room.reduce((a, b) => a + b, 0);
  gaps = gaps.map((g, i) => (total > 0 ? g + (diff * room[i]) / total : g));
  const longest = gaps.indexOf(Math.max(...gaps));
  [gaps[longest], gaps[n - 1]] = [gaps[n - 1], gaps[longest]];
  const wrap = gaps[n - 1];
  const starts = [quiet + (wrap - quiet - life) / 2];
  for (let i = 1; i < n; i++) starts.push(starts[i - 1] + gaps[i - 1]);
  return starts;
}
function glintSchedule(seed) {
  const r = random(seed);
  const starts = loopStarts(r, GLINTS_PER_LOOP, GLINT_GAP_S, 0, GLINT_LIFE_S);
  return starts.map((start) => ({ start, dot: Math.floor(r() * DAY_DOT_COUNT), rot: 3 * r(), vr: -1 + 2 * r() }));
}
function shotSchedule(seed) {
  const r = random(seed);
  const starts = loopStarts(r, SHOTS_PER_LOOP, SHOT_GAP_S, SHOT_QUIET_S, SHOT_LIFE_S);
  const deg = Math.PI / 180;
  return starts.map((start) => {
    const dir = r() < 0.5 ? 1 : -1;
    const vx = between(r, SHOT_VX);
    const lo = Math.max(SHOT_ANGLE_DEG.min * deg, Math.atan(SHOT_VY.min / vx));
    const hi = Math.min(SHOT_ANGLE_DEG.max * deg, Math.atan(SHOT_VY.max / vx));
    const angle = lo + (hi - lo) * r();
    return { start, dir, vx, vy: vx * Math.tan(angle), past: between(r, SHOT_PAST_PEAK), y0: SKY_TOP_PT + 1 + 3 * r() };
  });
}
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function nightness(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const { dawnFrom, dawnTo, duskFrom, duskTo } = SKY_TIMES;
  if (m < dawnFrom || m >= duskTo) return 1;
  if (m < dawnTo) return 1 - smoothstep((m - dawnFrom) / (dawnTo - dawnFrom));
  if (m < duskFrom) return 0;
  return smoothstep((m - duskFrom) / (duskTo - duskFrom));
}
const inLoop = (t) => ((t % LOOP_S) + LOOP_S) % LOOP_S;
const crispRadius = (z) => z * 0.32;
const starInner = (outer) => outer * 0.22;
const starCore = (outer) => Math.max(0.5, outer * 0.14);
const glintRadius = (age, size) => size * crispRadius(GLINT_SIZE * (0.4 + 0.8 * Math.sin(Math.PI * Math.min(1, Math.max(0, age / GLINT_LIFE_S)))));
const glintAlpha = (age) => (age <= 0 || age >= GLINT_LIFE_S ? 0 : Math.sin((Math.PI * age) / GLINT_LIFE_S));
const shotAlpha = (age) => (age <= 0 || age >= SHOT_LIFE_S ? 0 : Math.sin((Math.PI * age) / SHOT_LIFE_S));
function dotAlpha(s, t) {
  const w = 0.5 + 0.5 * Math.sin(t * s.fp + s.ph);
  return 0.35 + 0.55 * w * w;
}
function starAlpha(s, t) {
  const w = 0.5 + 0.5 * Math.sin(t * s.tw + s.ph);
  return 0.35 + 0.65 * w * w * w;
}
function capTrail(out, max) {
  let left = max;
  for (let i = out.length - 1; i > 0; i--) {
    const p = out[i];
    const q = out[i - 1];
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= left) {
      left -= d;
      continue;
    }
    const f = d > 0 ? left / d : 0;
    const end = { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
    for (let j = i - 1; j >= 0; j--) out[j] = end;
    break;
  }
}
function shotTrail(s, age) {
  const out = [];
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const a = Math.max(0, age - (TRAIL_POINTS - 1 - i) * SHOT_TRAIL_STEP_S);
    out.push({ x: s.x0 + s.vx * a, y: s.y0 + s.vy * a });
  }
  capTrail(out, TRAIL_MAX_PT);
  return out;
}

// 3. Geometry
function makeGeometry(W, H, size, starSize, ribbon, rects, foot = H) {
  let lineY = () => foot;
  let cx = W / 2;
  if (ribbon) {
    const { x: bx, y: by, w: bw, h: bh, yb, yc, stroke } = ribbon;
    cx = bx + bw / 2;
    lineY = (x) => {
      const u = (x - bx) / bw;
      const centre = by + ((yb - 2 * u * (1 - u) * (yb - yc)) / 100) * bh;
      const slope = (-((yb - yc) / 100) * bh * 2 * (1 - 2 * u)) / bw;
      return centre - (stroke / 2) * Math.sqrt(1 + slope * slope);
    };
  }
  const arcAbove = (x, r) => lineY(Math.min(x + r, Math.max(x - r, cx)));
  const ceilAt = (x, r) => arcAbove(x, r) - AMBIENT_CLEARANCE_PT - r;
  const clearOfText = (x, y, r) => {
    let k = 1;
    for (const q of rects) {
      const dx = Math.max(q.x - x, 0, x - (q.x + q.w));
      const dy = Math.max(q.y - y, 0, y - (q.y + q.h));
      const d = Math.hypot(dx, dy) - r - 1;
      if (d <= 0) return 0;
      if (d < FEATHER) k = Math.min(k, d / FEATHER);
    }
    return k;
  };
  return { W, H, size, starSize, cx, lineY, ceilAt, clearOfText };
}
function dotRMax(g, s) {
  return s.z * DOT_SCALE * g.size;
}
function dotX(g, s, t) {
  const r = dotRMax(g, s);
  return Math.min(g.W - r, Math.max(r, g.W * s.bx + s.ax * Math.sin(t * s.f1 + s.ph)));
}
function dotY(g, s, t, x) {
  const r = dotRMax(g, s);
  const floor = SKY_TOP_PT + r;
  const base = floor + s.v * Math.max(0, g.ceilAt(g.W * s.bx, r) - floor);
  const y = base + s.ay * Math.sin(t * s.f2 + s.ph2);
  return Math.min(g.ceilAt(x, r), Math.max(floor, y));
}
const dotR = (g, s, t) => dotRMax(g, s) * (0.95 + 0.05 * Math.sin(t * s.fs));
const starR = (g, s) => s.z * (s.big ? STAR_BIG_SCALE : STAR_DOT_SCALE) * g.starSize;
function starY(g, s, x) {
  const r = starR(g, s);
  const floor = SKY_TOP_PT + r;
  return Math.min(g.ceilAt(x, r), floor + s.v * Math.max(0, g.ceilAt(x, r) - floor));
}
function skyGlints(g, seeds, plans) {
  const peak = glintRadius(GLINT_LIFE_S / 2, g.size);
  return plans.map((plan) => {
    for (let k = 0; k < seeds.length; k++) {
      const dot = (plan.dot + k) % seeds.length;
      const s = seeds[dot];
      const x = dotX(g, s, plan.start);
      const y = dotY(g, s, plan.start, x);
      const fits = x >= peak && x <= g.W - peak && y >= SKY_TOP_PT + peak && y <= g.ceilAt(x, peak) && g.clearOfText(x, y, peak + FEATHER) > 0;
      if (fits) return { ...plan, dot, x, y, on: true };
    }
    return { ...plan, x: 0, y: 0, on: false };
  });
}
function shotFits(g, x0, y0, vx, vy) {
  const half = SHOT_WIDTH / 2;
  const steps = Math.ceil(Math.abs(vx) * SHOT_LIFE_S);
  for (let i = 0; i <= steps; i++) {
    const a = (SHOT_LIFE_S * i) / steps;
    const x = x0 + vx * a;
    if (x < 0 || x > g.W) continue;
    const y = y0 + vy * a;
    if (y - half < SKY_TOP_PT) return false;
    if (y > g.lineY(x) - SHOT_CLEARANCE_PT - half - 0.5) return false;
    if (!(g.clearOfText(x, y, half + FEATHER) > 0)) return false;
  }
  return true;
}
function skyShots(g, plans) {
  return plans.map((p) => {
    for (let vy = p.vy; ; vy = vy > 1 ? vy * 0.9 : 0) {
      for (const dir of [p.dir, -p.dir]) {
        for (let past = p.past; past <= g.W / 3; past += 2) {
          const x0 = g.cx + dir * past;
          if (shotFits(g, x0, p.y0, dir * p.vx, vy)) return { start: p.start, x0, y0: p.y0, vx: dir * p.vx, vy, on: true };
        }
      }
      if (vy === 0) break;
    }
    return { start: p.start, x0: g.cx, y0: p.y0, vx: p.dir * p.vx, vy: 0, on: false };
  });
}
function indexAt(list, t, life) {
  const at = inLoop(t);
  for (let i = 0; i < list.length; i++) {
    const age = at - list[i].start;
    if (age > 0 && age < life) return list[i].on ? i : -1;
  }
  return -1;
}
function skyFlying(shots, t) {
  const at = inLoop(t);
  const lead = FRAME_MS / 1000;
  for (const s of shots) if (s.on && at >= s.start - lead && at < s.start + SHOT_LIFE_S) return true;
  return false;
}

// 4. Draw
function starPath(ctx, x, y, r, rot) {
  const inner = starInner(r);
  ctx.beginPath();
  for (let n = 0; n < 8; n++) {
    const rad = n % 2 ? inner : r;
    const ang = (n * Math.PI) / 4 + rot;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (n === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function draw(ctx, scene, t, n, still) {
  const g = scene.g;
  ctx.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
  ctx.clearRect(0, 0, g.W, g.H);
  ctx.globalCompositeOperation = 'lighter';
  if (n > 0) {
    for (const f of scene.fields) {
      for (const s of f.night) {
        const x = g.W * s.bx;
        const y = starY(g, s, x);
        const r = starR(g, s);
        const k = g.clearOfText(x, y, r);
        if (!(k > 0)) continue;
        const a = starAlpha(s, t) * n * k;
        ctx.globalAlpha = a;
        ctx.fillStyle = PALETTE.star;
        if (s.big) {
          starPath(ctx, x, y, r, 0);
          ctx.fillStyle = PALETTE.glintCore;
          disc(ctx, x, y, starCore(r));
        } else disc(ctx, x, y, r);
      }
    }
    const shots = n >= SHOT_FROM_N && !still ? shotsFor(scene) : null;
    const at = shots ? indexAt(shots, t, SHOT_LIFE_S) : -1;
    if (at >= 0) {
      const shot = shots[at];
      const age = inLoop(t) - shot.start;
      const pts = shotTrail(shot, age);
      const alpha = shotAlpha(age) * n;
      ctx.strokeStyle = PALETTE.star;
      ctx.lineCap = 'butt';
      for (let j = 1; j < pts.length; j++) {
        ctx.lineWidth = (SHOT_WIDTH * j) / TRAIL_POINTS;
        ctx.globalAlpha = (alpha * j) / TRAIL_POINTS;
        ctx.beginPath();
        ctx.moveTo(pts[j - 1].x, pts[j - 1].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
  }
  const day = 1 - n;
  if (day > 0) {
    for (const f of scene.fields) {
      for (const s of f.day) {
        const x = dotX(g, s, t);
        const y = dotY(g, s, t, x);
        const r = dotR(g, s, t);
        const k = g.clearOfText(x, y, dotRMax(g, s));
        if (!(k > 0)) continue;
        ctx.globalAlpha = dotAlpha(s, t) * day * k;
        ctx.fillStyle = PALETTE.day[s.colour];
        disc(ctx, x, y, r);
      }
    }
    if (n < GLINT_UNTIL_N && !still) {
      for (const f of scene.fields) {
        const at = indexAt(f.glints, t, GLINT_LIFE_S);
        if (at < 0) continue;
        const gl = f.glints[at];
        const age = inLoop(t) - gl.start;
        const r = glintRadius(age, g.size);
        ctx.globalAlpha = glintAlpha(age) * day;
        ctx.fillStyle = PALETTE.glint;
        starPath(ctx, gl.x, gl.y, r, gl.rot + gl.vr * age);
        ctx.fillStyle = PALETTE.glintCore;
        disc(ctx, gl.x, gl.y, starCore(r));
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function shotsFor(scene) {
  if (!scene.shots) scene.shots = skyShots(scene.g, shotSchedule(SEEDS.shots));
  return scene.shots;
}

// 5. Hosts: the hero (by the clock), each night band (always night)
if (typeof IntersectionObserver !== 'function' || typeof ResizeObserver !== 'function' || typeof matchMedia !== 'function') return;
const off = matchMedia('(prefers-contrast: more), (forced-colors: active), print');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (typeof off.addEventListener !== 'function') return;

const seedCache = [];
const fieldSeeds = (j) => {
  if (!seedCache[j]) {
    const step = j * FIELD_SEED_STEP;
    const day = daySeeds(SEEDS.dots + step);
    const night = nightSeeds(SEEDS.stars + step);
    for (const [list, n, range] of [[day, DAY_DOT_COUNT, DOT_BX], [night, NIGHT_STAR_COUNT, STAR_X]]) {
      const shift = (j * (range.max - range.min)) / (n - 1) / MAX_FIELDS;
      for (const seed of list) seed.bx += seed.bx < 0.5 ? shift : -shift;
    }
    if (j > 0) for (const seed of night) seed.v = 0.06 + ((seed.v - 0.06) / 0.44) * 0.92;
    seedCache[j] = { day, night, plans: glintSchedule(SEEDS.glints + step) };
  }
  return seedCache[j];
};
function readPalette() {
  if (PALETTE.star) return true;
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  const day = [v('--dl-sky-day-0'), v('--dl-sky-day-1'), v('--dl-sky-day-2')];
  const rest = [v('--dl-sky-glint'), v('--dl-sky-glint-core'), v('--dl-sky-star')];
  if (![...day, ...rest].every(Boolean)) return false;
  [PALETTE.day, PALETTE.glint, PALETTE.glintCore, PALETTE.star] = [day, ...rest];
  return true;
}
const wantsMotion = () => !reduce.matches;
// Below 720 px: clear of each text line, button and capture
function lineBoxes(el, range, out) {
  for (const c of el.childNodes) {
    if (c.nodeType === 3) {
      range.selectNodeContents(c);
      out.push(...range.getClientRects());
    } else if (c.nodeType === 1) {
      if (c.matches(BOX)) out.push(c.getBoundingClientRect());
      else lineBoxes(c, range, out);
    }
  }
  return out;
}

function host(el, canvas, night) {
  let ctx = null;
  let dead = false;
  let onScreen = false;
  let dirty = true;
  let scene = null;
  let key = '';
  let t = 0;
  let n = night ? 1 : 0;
  let clockAt = 0;
  let raf = 0;
  let timer = 0;
  let last = -1;
  let rebuildTimer = 0;
  let observing = false;

  const io = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    update();
  });
  const ro = new ResizeObserver(() => markDirty());
  const allowed = () => !dead && !off.matches && !!ctx && canvas.getClientRects().length > 0;
  const running = () => allowed() && wantsMotion() && onScreen && !document.hidden;
  const mark = (on) => el.classList.toggle(SKY_CLASS, on);

  function readClock() {
    if (night) return;
    const d = new Date();
    n = nightness(d.getHours() * 60 + d.getMinutes());
  }
  function checkClock() {
    if (t - clockAt >= CLOCK_EVERY_S || t < clockAt) {
      clockAt = t;
      const was = n;
      readClock();
      if (was < SHOT_FROM_N && n >= SHOT_FROM_N) scene.shots = null;
    }
  }
  function start() {
    if (raf || timer || !running()) return;
    readClock();
    last = -1;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    const was = raf || timer;
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = timer = 0;
    last = -1;
    return was;
  }
  function frame(now) {
    raf = 0;
    if (last < 0) {
      last = now;
      arm();
      return;
    }
    const dt = now - last;
    last = now;
    t += Math.min(MAX_ADVANCE_MS, Math.max(0, dt)) / 1000;
    checkClock();
    draw(ctx, scene, t, n);
    arm();
  }
  function arm() {
    if (!running()) return;
    if (n >= SHOT_FROM_N && skyFlying(shotsFor(scene), t)) raf = requestAnimationFrame(frame);
    else
      timer = setTimeout(() => {
        timer = 0;
        raf = requestAnimationFrame(frame);
      }, FRAME_MS - 3);
  }
  function markDirty() {
    dirty = true;
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = 0;
    if (allowed() && onScreen) {
      rebuildTimer = setTimeout(() => {
        rebuildTimer = 0;
        update();
      }, REBUILD_MS);
    }
  }
  function readRibbon(box) {
    const svg = [...el.querySelectorAll('svg.hero-ribbon')].find((x) => x.getClientRects().length > 0);
    const path = svg && svg.querySelector('path');
    if (!path) return null;
    const m = RIBBON_D.exec(path.getAttribute('d') || '');
    if (!m) return null;
    const r = svg.getBoundingClientRect();
    const stroke = parseFloat(getComputedStyle(path).strokeWidth) || 0;
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height, yb: Number(m[1]), yc: Number(m[2]), stroke };
  }
  function rebuild() {
    const box = el.getBoundingClientRect();
    const W = box.width;
    const H = box.height;
    const dpr = Math.min(DPR_MAX, devicePixelRatio || 1);
    const ribbon = night ? null : readRibbon(box);
    const wide = W >= WIDE_FROM_PX;
    const range = wide ? null : document.createRange();
    // A capture's box takes in its plates (::after offset)
    const rects = [...el.querySelectorAll('[data-sky-avoid]')]
      .flatMap((a) => {
        if (!a.matches(BOX)) return wide ? [a.getBoundingClientRect()] : lineBoxes(a, range, []);
        const q = a.getBoundingClientRect();
        const k = parseFloat(getComputedStyle(a, '::after').translate) || 0;
        return [{ left: q.left, top: q.top, width: q.width + k, height: q.height + k }];
      })
      .filter((q) => q.width > 0 && q.height > 0)
      .map((q) => ({ x: q.left - box.left, y: q.top - box.top, w: q.width, h: q.height }));
    const next = JSON.stringify([W, H, dpr, ribbon, rects]);
    dirty = false;
    if (next === key && scene) return;
    key = next;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const lift = !wide || W >= LARGE_FROM_PX;
    // Phones: a box past the foot (the breakout capture) is the line
    const foot = Math.min(H, ...rects.filter((q) => !wide && q.y + q.h > H).map((q) => q.y));
    const g = makeGeometry(W, H, lift ? LARGE_SCALE : 1, lift ? LARGE_STAR_SCALE : 1, ribbon, rects, foot);
    // Phones: a field per 375 x 100 px of canvas, 1 to 8
    const count = wide ? MAX_FIELDS : Math.min(MAX_FIELDS, Math.max(1, Math.floor((W * H) / FIELD_AREA)));
    const fields = [];
    for (let j = 0; j < count; j++) {
      const f = fieldSeeds(j);
      fields.push({ day: f.day, night: f.night, glints: night ? [] : skyGlints(g, f.day, f.plans) });
    }
    scene = { g, dpr, fields, shots: null };
    draw(ctx, scene, t, n, !wantsMotion());
  }
  function kill() {
    dead = true;
    stop();
    io.disconnect();
    ro.disconnect();
    mark(false);
  }
  function update() {
    if (dead) return;
    if (off.matches) {
      stop();
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = 0;
      if (observing) {
        io.disconnect();
        ro.disconnect();
        observing = false;
      }
      onScreen = false;
      canvas.width = canvas.height = 0;
      scene = null;
      key = '';
      dirty = true;
      mark(false);
      return;
    }
    if (!observing) {
      observing = true;
      io.observe(el);
      ro.observe(el);
      for (const a of el.querySelectorAll('[data-sky-avoid]')) ro.observe(a);
    }
    if (!onScreen) {
      stop();
      return;
    }
    if (!ctx) {
      ctx = canvas.getContext('2d');
      if (!ctx || !readPalette()) return kill();
      readClock();
    }
    if (canvas.getClientRects().length === 0) {
      stop();
      mark(false);
      return;
    }
    if (dirty || !scene) rebuild();
    mark(true);
    if (running()) start();
    // Reduced motion mid-flight: a still frame
    else if (stop() && !wantsMotion()) draw(ctx, scene, t, n, true);
  }
  return { update, markDirty };
}

const hosts = [];
const hero = document.getElementById('hero');
const heroSky = hero && hero.querySelector('canvas.hero-sky');
if (heroSky) hosts.push(host(hero, heroSky, false));
for (const band of document.querySelectorAll('.band-night')) {
  const sky = band.querySelector('canvas.night-sky');
  if (sky) hosts.push(host(band, sky, true));
}
if (!hosts.length) return;
const updateAll = () => hosts.forEach((h) => h.update());
off.addEventListener('change', updateAll);
reduce.addEventListener('change', updateAll);
document.addEventListener('visibilitychange', updateAll);
addEventListener('pageshow', updateAll);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => hosts.forEach((h) => h.markDirty()));
if (document.readyState === 'loading' || document.readyState === 'interactive') addEventListener('load', updateAll, { once: true });
else updateAll();
})();
