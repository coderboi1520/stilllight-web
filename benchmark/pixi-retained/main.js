import { Application, Container } from 'pixi.js';
import { StilllightModel } from '../../src/core/model.ts';
import {
  clamp01, position, pourDirection, pouringLip, smoother,
  streamControl, tiltForUnits,
} from '../../src/core/geometry.ts';
import {
  GLASS_HALF_WIDTH, GLASS_HEIGHT, HINT_ATTENTION_MS, INVALID_MS,
  SELECT_LIFT,
} from '../../src/core/constants.ts';
import { liquidTop } from '../../src/core/liquidMath.ts';
import { GlassView } from '../../src/render/pixi/GlassView.ts';
import { StreamView } from '../../src/render/pixi/StreamView.ts';
import { configureAssetDensity } from '../../src/render/pixi/assets.ts';
import { TEN_GLASS_WORKLOAD } from '../shared/workload.js';

const STRESS_W = 760;
const STRESS_H = 620;
const CYCLE_MS = 13250;
const SAMPLE_MS = 250;
const RECENT_SAMPLES = 120;
const PAIR_INITIALS = [0, 1, 2, 3, 0].map((color) => [[color, color], [color]]);
const SCRIPT = TEN_GLASS_WORKLOAD.events;

const host = document.querySelector('#pixi-benchmark-host');
const stage = document.querySelector('.stage');
const hud = {
  cycle: document.querySelector('[data-live="cycle"]'),
  elapsed: document.querySelector('[data-live="elapsed"]'),
  fps: document.querySelector('[data-live="fps"]'),
  min: document.querySelector('[data-live="min-fps"]'),
  avg: document.querySelector('[data-live="avg-fps"]'),
  max: document.querySelector('[data-live="max-fps"]'),
  frame: document.querySelector('[data-live="frame-ms"]'),
  glasses: document.querySelector('[data-live="active-glasses"]'),
  pours: document.querySelector('[data-live="active-pours"]'),
};

// The production M1 model is intentionally a two-glass model. The benchmark
// composes five independent production-model instances to create ten glasses,
// while all rendering stays in one retained Pixi/WebGL scene.
const models = Array.from({ length: 5 }, () => new StilllightModel());
const pairFrames = new Array(5);
const app = new Application();
const scene = new Container();
const glassViews = Array.from({ length: 10 }, () => new GlassView());
const streamViews = Array.from({ length: 5 }, () => new StreamView());
const glassFrames = Array.from({ length: 10 }, (_, index) => ({
  index,
  pose: { x: 0, y: 0, angle: 0 },
  surfaceAngle: 0,
  relativeLiquidRotation: 0,
  wave: 0,
  phase: 0,
  dynamicLiquid: false,
  layers: [],
  selected: false,
  hintRole: null,
  invalid: false,
  moving: false,
}));
const streamFrames = Array.from({ length: 5 }, () => ({
  visible: true,
  color: 0,
  alpha: 0,
  start: { x: 0, y: 0 },
  control: { x: 0, y: 0 },
  end: { x: 0, y: 0 },
  impact: 0,
}));

const scratchLocalHome = { x: 0, y: 0 };
const scratchStressHome = { x: 0, y: 0 };
const activeFlags = new Uint8Array(10);
const counts = { glasses: 0, pours: 0 };
const recentFrameTimes = new Float64Array(RECENT_SAMPLES);
const invalids = [];

let cycle = 0;
let cycleStarted = 0;
let eventIndex = 0;
let lastFrameAt = 0;
let recentIndex = 0;
let recentCount = 0;
let recentSum = 0;
let currentFps = 0;
let nextHudAt = 0;
let nextSampleAt = 0;
let minFps = Infinity;
let maxFps = 0;
let fpsSum = 0;
let fpsSamples = 0;
let movingMask = -1;

function stressPosition(index, out = scratchStressHome) {
  out.x = 76 + (index % 5) * 152;
  out.y = 96 + Math.floor(index / 5) * 292;
  return out;
}

function stressPourDirection(source, target) {
  const sx = 76 + (source % 5) * 152;
  const tx = 76 + (target % 5) * 152;
  if (tx < STRESS_W / 2) return -1;
  if (tx > STRESS_W / 2) return 1;
  if (sx !== tx) return sx < tx ? 1 : -1;
  return source < target ? 1 : -1;
}

function clampStressPose(x, y, angle, out) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x0 = -GLASS_HALF_WIDTH;
  const x1 = GLASS_HALF_WIDTH;
  const y1 = GLASS_HEIGHT;
  const p0x = x + x0 * c;
  const p0y = y + x0 * s;
  const p1x = x + x1 * c;
  const p1y = y + x1 * s;
  const p2x = x + x1 * c - y1 * s;
  const p2y = y + x1 * s + y1 * c;
  const p3x = x + x0 * c - y1 * s;
  const p3y = y + x0 * s + y1 * c;
  const minX = Math.min(p0x, p1x, p2x, p3x);
  const maxX = Math.max(p0x, p1x, p2x, p3x);
  const minY = Math.min(p0y, p1y, p2y, p3y);
  const maxY = Math.max(p0y, p1y, p2y, p3y);
  const margin = 8;
  if (minX < margin) x += margin - minX;
  if (maxX > STRESS_W - margin) x -= maxX - (STRESS_W - margin);
  if (minY < margin) y += margin - minY;
  if (maxY > STRESS_H - margin) y -= maxY - (STRESS_H - margin);
  out.x = x;
  out.y = y;
  out.angle = angle;
  return out;
}

// Ten-glass benchmark layout adapter built from the NEW core easing/tilt rules.
// It extends production geometry to the benchmark viewport; it does not import
// or execute the original Canvas implementation.
function stressMovingPose(source, target, progress, remainingUnits, out) {
  const hx = 76 + (source % 5) * 152;
  const hy = 96 + Math.floor(source / 5) * 292;
  const dx = 76 + (target % 5) * 152;
  const dy = 96 + Math.floor(target / 5) * 292;
  const direction = stressPourDirection(source, target);
  const p = clamp01(progress);
  const approach = smoother(p / 0.28);
  const retreat = smoother((p - 0.70) / 0.30);
  const presence = approach * (1 - retreat);
  const tiltIn = smoother((p - 0.10) / 0.22);
  const tiltOut = smoother((p - 0.68) / 0.20);
  const angle = direction * tiltForUnits(remainingUnits) * tiltIn * (1 - tiltOut);
  const lipOffsetX = direction * GLASS_HALF_WIDTH * Math.cos(angle);
  const pourCenterX = dx - lipOffsetX;
  const sameRow = Math.floor(source / 5) === Math.floor(target / 5);
  const pourCenterY = dy - (sameRow ? 82 : 135);
  const startY = hy - SELECT_LIFT;
  const returnToSlot = SELECT_LIFT * smoother((p - 0.80) / 0.20);
  const travelArc = -9 * Math.sin(Math.PI * Math.min(1, approach)) * (1 - retreat);
  const returnSettle = p > 0.78
    ? 2.2 * Math.sin((p - 0.78) / 0.22 * Math.PI) * (1 - p) / 0.22
    : 0;
  return clampStressPose(
    hx + (pourCenterX - hx) * presence,
    startY + returnToSlot + (pourCenterY - startY) * presence + travelArc + returnSettle,
    angle,
    out,
  );
}

function stressInvalidPose(index, progress, direction, out) {
  const hx = 76 + (index % 5) * 152;
  const hy = 96 + Math.floor(index / 5) * 292;
  const p = clamp01(progress);
  const env = Math.pow(1 - p, 1.35);
  const osc = Math.sin(p * Math.PI * 5.4);
  const returnHome = smoother((p - 0.70) / 0.30);
  return clampStressPose(
    hx + direction * 8.5 * osc * env,
    hy - SELECT_LIFT * (1 - returnHome) + 1.2 * Math.sin(p * Math.PI * 2) * env,
    direction * 0.075 * osc * env,
    out,
  );
}

const density = Math.min(devicePixelRatio || 1, 2);
configureAssetDensity(density);
await app.init({
  width: STRESS_W,
  height: STRESS_H,
  resolution: density,
  autoDensity: true,
  antialias: true,
  background: '#071219',
  preference: 'webgl',
  autoStart: false,
  sharedTicker: false,
});
app.ticker.stop();
// Same manual-render ownership as the production retained renderer.
// @ts-ignore Pixi runtime accepts null despite its declaration.
app.renderer.events.setTargetElement(null);
app.renderer.gc.enabled = false;
app.renderer.scheduler.destroy();
host.appendChild(app.canvas);
app.stage.addChild(scene);
for (const view of glassViews) scene.addChild(view.root);
for (const view of streamViews) scene.addChild(view.root);

function resize() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  app.renderer.resize(Math.max(1, rect.width), Math.max(1, rect.height), dpr);
  scene.scale.set(rect.width / STRESS_W, rect.height / STRESS_H);
}
new ResizeObserver(resize).observe(stage);
resize();

function clonePair(pair) {
  return pair.map((glass) => [...glass]);
}

function clearSelections(now) {
  for (const model of models) {
    if (model.selected !== null && !model.busy) model.choose(model.selected, now);
  }
}

function resetModels() {
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    model.reset();
    model.board = clonePair(PAIR_INITIALS[i]);
  }
}

function startCycle(now) {
  resetModels();
  invalids.length = 0;
  eventIndex = 0;
  cycleStarted = now;
  cycle += 1;
  hud.cycle.textContent = String(cycle);
}

function startPairPour(globalSource, globalTarget, now) {
  const pairIndex = Math.floor(globalSource / 2);
  if (pairIndex !== Math.floor(globalTarget / 2)) return false;
  const model = models[pairIndex];
  if (model.busy) return false;
  const localSource = globalSource % 2;
  const localTarget = globalTarget % 2;
  model.choose(localSource, now);
  model.choose(localTarget, now);
  return Boolean(model.flight);
}

function startInvalid(source, target, now) {
  clearSelections(now);
  const sx = 76 + (source % 5) * 152;
  const tx = 76 + (target % 5) * 152;
  invalids.push({ source, target, direction: tx >= sx ? 1 : -1, started: now });
}

function startHint(source, target, now) {
  const pairIndex = Math.floor(source / 2);
  if (pairIndex !== Math.floor(target / 2)) return;
  // Current workload hints are source-local-0 -> target-local-1, exactly the
  // production StilllightModel hint path.
  models[pairIndex].hint(now);
}

function dispatchEvent(event, now) {
  if (event.type === 'selection') {
    const pair = Math.floor(event.index / 2);
    models[pair].choose(event.index % 2, now);
    return;
  }
  if (event.type === 'hint') {
    startHint(event.source, event.target, now);
    return;
  }
  if (event.type === 'invalid') {
    startInvalid(event.source, event.target, now);
    return;
  }
  if (event.type === 'pours') {
    clearSelections(now);
    for (const [source, target] of event.pairs) startPairPour(source, target, now);
  }
}

function consumeEvents(now) {
  const elapsed = now - cycleStarted;
  while (eventIndex < SCRIPT.length && SCRIPT[eventIndex].at <= elapsed) {
    dispatchEvent(SCRIPT[eventIndex], now);
    eventIndex += 1;
  }
}

function copyGlass(globalIndex, sourceFrame, model, pairIndex, pairFrame, now) {
  const out = glassFrames[globalIndex];
  const localIndex = globalIndex % 2;
  position(localIndex, scratchLocalHome);
  stressPosition(globalIndex, scratchStressHome);

  out.layers = sourceFrame.layers;
  out.surfaceAngle = sourceFrame.surfaceAngle;
  out.wave = sourceFrame.wave;
  out.phase = sourceFrame.phase;
  out.dynamicLiquid = sourceFrame.dynamicLiquid;
  out.selected = sourceFrame.selected;
  out.hintRole = sourceFrame.hintRole;
  out.invalid = false;
  out.moving = false;
  out.pose.x = scratchStressHome.x + (sourceFrame.pose.x - scratchLocalHome.x);
  out.pose.y = scratchStressHome.y + (sourceFrame.pose.y - scratchLocalHome.y);
  out.pose.angle = sourceFrame.pose.angle;

  const flight = model.flight;
  if (flight) {
    const globalSource = pairIndex * 2 + flight.source;
    const globalTarget = pairIndex * 2 + flight.target;
    const sign = stressPourDirection(globalSource, globalTarget) / pourDirection(flight.source, flight.target);
    out.surfaceAngle = sourceFrame.surfaceAngle * sign;
    if (localIndex === flight.source) {
      const remainingUnits = flight.before[flight.source].length - flight.amount * pairFrame.metrics.transfer;
      stressMovingPose(globalSource, globalTarget, pairFrame.metrics.pourProgress, remainingUnits, out.pose);
      out.moving = true;
    }
  }

  for (let i = 0; i < invalids.length; i++) {
    const invalid = invalids[i];
    if (invalid.source !== globalIndex && invalid.target !== globalIndex) continue;
    out.invalid = true;
    if (invalid.source === globalIndex) {
      const p = clamp01((now - invalid.started) / INVALID_MS);
      stressInvalidPose(globalIndex, p, invalid.direction, out.pose);
    }
    break;
  }

  out.relativeLiquidRotation = -out.pose.angle + out.surfaceAngle;
}

function composeFrames(now) {
  for (let i = 0; i < models.length; i++) pairFrames[i] = models[i].sample(now);

  for (let pairIndex = 0; pairIndex < models.length; pairIndex++) {
    const model = models[pairIndex];
    const pairFrame = pairFrames[pairIndex];
    copyGlass(pairIndex * 2, pairFrame.glasses[0], model, pairIndex, pairFrame, now);
    copyGlass(pairIndex * 2 + 1, pairFrame.glasses[1], model, pairIndex, pairFrame, now);

    const flight = model.flight;
    const streamView = streamViews[pairIndex];
    if (!flight || !pairFrame.stream) {
      streamView.update(null);
      continue;
    }

    const globalSource = pairIndex * 2 + flight.source;
    const globalTarget = pairIndex * 2 + flight.target;
    const moving = glassFrames[globalSource];
    const direction = stressPourDirection(globalSource, globalTarget);
    const stream = streamFrames[pairIndex];
    const targetUnits = flight.before[flight.target].length + flight.amount * pairFrame.metrics.transfer;

    stream.visible = true;
    stream.color = pairFrame.stream.color;
    stream.alpha = pairFrame.stream.alpha;
    stream.impact = pairFrame.stream.impact;
    pouringLip(moving.pose, direction, stream.start);
    stressPosition(globalTarget, stream.end);
    stream.end.y += liquidTop(targetUnits) + 1;
    streamControl(stream.start, stream.end, direction, stream.control);
    streamView.update(stream);
  }
}

function updateDrawOrder() {
  let nextMask = 0;
  for (let i = 0; i < 10; i++) if (glassFrames[i].moving) nextMask |= (1 << i);
  if (nextMask === movingMask) return;
  movingMask = nextMask;
  let at = 0;
  for (let i = 0; i < 10; i++) if (!(nextMask & (1 << i))) scene.setChildIndex(glassViews[i].root, at++);
  for (let i = 0; i < 10; i++) if (nextMask & (1 << i)) scene.setChildIndex(glassViews[i].root, at++);
  for (const view of streamViews) scene.setChildIndex(view.root, at++);
}

function markActive(index) {
  if (index >= 0 && index < 10) activeFlags[index] = 1;
}

function activeCounts(now) {
  activeFlags.fill(0);
  let pours = 0;
  for (let pairIndex = 0; pairIndex < models.length; pairIndex++) {
    const model = models[pairIndex];
    if (model.flight) {
      pours += 1;
      markActive(pairIndex * 2 + model.flight.source);
      markActive(pairIndex * 2 + model.flight.target);
    }
    if (model.settleMotion) {
      markActive(pairIndex * 2 + model.settleMotion.source);
      markActive(pairIndex * 2 + model.settleMotion.target);
    }
    if (model.selectionPulse) markActive(pairIndex * 2 + model.selectionPulse.index);
    if (model.hintMotion) {
      markActive(pairIndex * 2 + model.hintMotion.source);
      markActive(pairIndex * 2 + model.hintMotion.target);
    }
  }
  for (let i = 0; i < invalids.length; i++) {
    markActive(invalids[i].source);
    markActive(invalids[i].target);
  }
  let glasses = 0;
  for (let i = 0; i < activeFlags.length; i++) glasses += activeFlags[i];
  counts.glasses = glasses;
  counts.pours = pours;
  return counts;
}

function updateStats(now, elapsed, activity) {
  if (lastFrameAt > 0) {
    const delta = now - lastFrameAt;
    if (delta > 0) {
      if (recentCount < RECENT_SAMPLES) {
        recentFrameTimes[recentIndex] = delta;
        recentSum += delta;
        recentCount += 1;
      } else {
        recentSum -= recentFrameTimes[recentIndex];
        recentFrameTimes[recentIndex] = delta;
        recentSum += delta;
      }
      recentIndex = (recentIndex + 1) % RECENT_SAMPLES;
      currentFps = 1000 / (recentSum / recentCount);
    }
  }
  lastFrameAt = now;

  if (now >= nextSampleAt && Number.isFinite(currentFps) && currentFps > 0) {
    minFps = Math.min(minFps, currentFps);
    maxFps = Math.max(maxFps, currentFps);
    fpsSum += currentFps;
    fpsSamples += 1;
    nextSampleAt = now + SAMPLE_MS;
  }

  if (now < nextHudAt) return;
  nextHudAt = now + 150;
  const frameMs = currentFps > 0 ? 1000 / currentFps : 0;
  hud.elapsed.textContent = `${(elapsed / 1000).toFixed(2)} s`;
  hud.fps.textContent = currentFps > 0 ? currentFps.toFixed(1) : '—';
  hud.min.textContent = Number.isFinite(minFps) ? minFps.toFixed(1) : '—';
  hud.avg.textContent = fpsSamples ? (fpsSum / fpsSamples).toFixed(1) : '—';
  hud.max.textContent = maxFps > 0 ? maxFps.toFixed(1) : '—';
  hud.frame.textContent = frameMs > 0 ? `${frameMs.toFixed(2)} ms` : '—';
  hud.glasses.textContent = String(activity.glasses);
  hud.pours.textContent = String(activity.pours);
}

function advanceModels(now) {
  for (const model of models) model.advanceAfterFrame(now);
  let write = 0;
  for (let read = 0; read < invalids.length; read++) {
    const item = invalids[read];
    if (now - item.started < INVALID_MS) invalids[write++] = item;
  }
  invalids.length = write;
}

function draw(now) {
  let elapsed = now - cycleStarted;
  if (elapsed >= CYCLE_MS) {
    startCycle(now);
    elapsed = 0;
  }

  consumeEvents(now);
  composeFrames(now);
  for (let i = 0; i < 10; i++) glassViews[i].update(glassFrames[i]);
  updateDrawOrder();
  app.renderer.render(app.stage);
  advanceModels(now);
  updateStats(now, elapsed, activeCounts(now));
  requestAnimationFrame(draw);
}

startCycle(performance.now());
requestAnimationFrame(draw);
