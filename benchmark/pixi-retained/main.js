import { Application, Container } from 'pixi.js';
import { StilllightModel } from '../../src/core/model.ts';
import { position, pourDirection } from '../../src/core/geometry.ts';
import { HINT_ATTENTION_MS, INVALID_MS, POUR_MS, SELECT_MS } from '../../src/core/constants.ts';
import { liquidTop } from '../../src/core/liquidMath.ts';
import { GlassView } from '../../src/render/pixi/GlassView.ts';
import { StreamView } from '../../src/render/pixi/StreamView.ts';
import { configureAssetDensity } from '../../src/render/pixi/assets.ts';
import {
  STRESS_H, STRESS_W, clamp01, pouringLip, stressInvalidPose,
  stressMovingPose, stressPosition, stressPourDirection, streamControl,
} from '../original-canvas/src/geometry.js';
import { BENCHMARK_SCRIPTS } from '../original-canvas/src/benchmark.js';

const CYCLE_MS = 13250;
const SAMPLE_MS = 250;
const PAIR_INITIALS = [0, 1, 2, 3, 0].map((color) => [[color, color], [color]]);
const SCRIPT = BENCHMARK_SCRIPTS['10-glass'].events;

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

const models = Array.from({ length: 5 }, () => new StilllightModel());
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

let cycle = 0;
let cycleStarted = 0;
let eventIndex = 0;
let lastFrameAt = 0;
let recentFrameTimes = [];
let currentFps = 0;
let nextHudAt = 0;
let nextSampleAt = 0;
let minFps = Infinity;
let maxFps = 0;
let fpsSum = 0;
let fpsSamples = 0;
let hint = null;
let invalids = [];
let movingOrderKey = '';

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
// Same production discipline as PixiRenderer: manual render ownership only.
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

function resetModels() {
  models.forEach((model, index) => {
    model.reset();
    model.board = clonePair(PAIR_INITIALS[index]);
  });
}

function clearSelections() {
  for (const model of models) {
    model.selected = null;
    model.selectionPulse = null;
  }
}

function startCycle(now) {
  resetModels();
  clearSelections();
  hint = null;
  invalids = [];
  eventIndex = 0;
  cycleStarted = now;
  cycle += 1;
  hud.cycle.textContent = String(cycle);
}

function startPairPour(globalSource, globalTarget, now) {
  const pairIndex = Math.floor(globalSource / 2);
  if (pairIndex !== Math.floor(globalTarget / 2)) return false;
  const model = models[pairIndex];
  const localSource = globalSource % 2;
  const localTarget = globalTarget % 2;
  if (model.flight || model.invalidMotion) return false;
  model.choose(localSource, now);
  model.choose(localTarget, now);
  return Boolean(model.flight);
}

function startInvalid(source, target, now) {
  clearSelections();
  const pairIndex = Math.floor(source / 2);
  const localSource = source % 2;
  const model = models[pairIndex];
  if (model.flight || model.invalidMotion) return false;
  const sp = stressPosition(source);
  const tp = stressPosition(target);
  const direction = tp.x >= sp.x ? 1 : -1;
  model.invalidMotion = { source: localSource, target: 1 - localSource, direction, started: now };
  model.invalidSource = localSource;
  model.invalidTarget = null;
  model.busy = true;
  invalids.push({ source, target, direction, started: now });
  return true;
}

function dispatchEvent(event, now) {
  if (event.type === 'selection') {
    const pair = Math.floor(event.index / 2);
    const local = event.index % 2;
    models[pair].choose(local, now);
    return;
  }
  if (event.type === 'hint') {
    hint = { source: event.source, target: event.target, started: now };
    return;
  }
  if (event.type === 'invalid') {
    startInvalid(event.source, event.target, now);
    return;
  }
  if (event.type === 'pours') {
    clearSelections();
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

function copyGlass(globalIndex, sourceFrame, model, pairIndex, now) {
  const out = glassFrames[globalIndex];
  const localIndex = globalIndex % 2;
  const localHome = position(localIndex);
  const home = stressPosition(globalIndex);

  out.layers = sourceFrame.layers;
  out.surfaceAngle = sourceFrame.surfaceAngle;
  out.wave = sourceFrame.wave;
  out.phase = sourceFrame.phase;
  out.dynamicLiquid = sourceFrame.dynamicLiquid;
  out.selected = sourceFrame.selected;
  out.hintRole = null;
  out.invalid = false;
  out.moving = false;
  out.pose.x = home.x + (sourceFrame.pose.x - localHome.x);
  out.pose.y = home.y + (sourceFrame.pose.y - localHome.y);
  out.pose.angle = sourceFrame.pose.angle;

  const flight = model.flight;
  if (flight) {
    const globalSource = pairIndex * 2 + flight.source;
    const globalTarget = pairIndex * 2 + flight.target;
    const localDirection = pourDirection(flight.source, flight.target);
    const globalDirection = stressPourDirection(globalSource, globalTarget);
    const sign = globalDirection / localDirection;
    out.surfaceAngle = sourceFrame.surfaceAngle * sign;

    if (localIndex === flight.source) {
      const remainingUnits = sourceFrame.layers.reduce((sum, layer) => sum + layer.amount, 0);
      const pose = stressMovingPose(globalSource, globalTarget, model.sampleFrame?.metrics?.pourProgress ?? 0, remainingUnits);
      // sampleFrame is not a model API; the pose is replaced below from the sampled pair frame.
      out.pose.x = pose.x;
      out.pose.y = pose.y;
      out.pose.angle = pose.angle;
      out.moving = true;
    }
  }

  const invalid = invalids.find((item) => item.source === globalIndex || item.target === globalIndex);
  if (invalid) {
    out.invalid = true;
    if (invalid.source === globalIndex) {
      const p = clamp01((now - invalid.started) / INVALID_MS);
      const pose = stressInvalidPose(globalIndex, p, invalid.direction);
      out.pose.x = pose.x;
      out.pose.y = pose.y;
      out.pose.angle = pose.angle;
    }
  }

  if (hint && now - hint.started < HINT_ATTENTION_MS && !out.moving && !out.invalid && (hint.source === globalIndex || hint.target === globalIndex)) {
    const p = clamp01((now - hint.started) / HINT_ATTENTION_MS);
    const lift = Math.sin(Math.PI * p);
    const dir = hint.source === globalIndex ? -1 : 1;
    out.pose.y -= 7 * lift;
    out.pose.x += dir * 1.6 * Math.sin(p * Math.PI * 4) * lift;
    out.hintRole = hint.source === globalIndex ? 'source' : 'target';
  }

  out.relativeLiquidRotation = -out.pose.angle + out.surfaceAngle;
  return out;
}

function composeFrames(now) {
  const pairFrames = models.map((model) => model.sample(now));

  for (let pairIndex = 0; pairIndex < models.length; pairIndex++) {
    const model = models[pairIndex];
    const pairFrame = pairFrames[pairIndex];
    // Expose the just-sampled progress only inside this benchmark adapter.
    model.sampleFrame = pairFrame;
    for (let local = 0; local < 2; local++) {
      const global = pairIndex * 2 + local;
      copyGlass(global, pairFrame.glasses[local], model, pairIndex, now);
    }

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
    const target = stressPosition(globalTarget);
    stream.end.x = target.x;
    stream.end.y = target.y + liquidTop(targetUnits) + 1;
    streamControl(stream.start, stream.end, direction, stream.control);
    streamView.update(stream);
  }

  return pairFrames;
}

function fixMovingPoses(pairFrames) {
  for (let pairIndex = 0; pairIndex < models.length; pairIndex++) {
    const model = models[pairIndex];
    const flight = model.flight;
    if (!flight) continue;
    const pairFrame = pairFrames[pairIndex];
    const globalSource = pairIndex * 2 + flight.source;
    const globalTarget = pairIndex * 2 + flight.target;
    const frame = glassFrames[globalSource];
    const remainingUnits = pairFrame.glasses[flight.source].layers.reduce((sum, layer) => sum + layer.amount, 0);
    const pose = stressMovingPose(globalSource, globalTarget, pairFrame.metrics.pourProgress, remainingUnits);
    frame.pose.x = pose.x;
    frame.pose.y = pose.y;
    frame.pose.angle = pose.angle;
    frame.relativeLiquidRotation = -frame.pose.angle + frame.surfaceAngle;
  }
}

function updateDrawOrder() {
  const moving = glassFrames.filter((frame) => frame.moving).map((frame) => frame.index);
  const key = moving.join(',');
  if (key === movingOrderKey) return;
  movingOrderKey = key;
  const movingSet = new Set(moving);
  let at = 0;
  for (let i = 0; i < 10; i++) if (!movingSet.has(i)) scene.setChildIndex(glassViews[i].root, at++);
  for (const index of moving) scene.setChildIndex(glassViews[index].root, at++);
  for (const view of streamViews) scene.setChildIndex(view.root, at++);
}

function activeCounts(now) {
  const active = new Set();
  let pours = 0;
  for (let pairIndex = 0; pairIndex < models.length; pairIndex++) {
    const model = models[pairIndex];
    if (model.flight) {
      pours += 1;
      active.add(pairIndex * 2 + model.flight.source);
      active.add(pairIndex * 2 + model.flight.target);
    }
    if (model.settleMotion) {
      active.add(pairIndex * 2 + model.settleMotion.source);
      active.add(pairIndex * 2 + model.settleMotion.target);
    }
    if (model.selectionPulse) active.add(pairIndex * 2 + model.selectionPulse.index);
  }
  for (const invalid of invalids) { active.add(invalid.source); active.add(invalid.target); }
  if (hint && now - hint.started < HINT_ATTENTION_MS) { active.add(hint.source); active.add(hint.target); }
  return { glasses: active.size, pours };
}

function updateStats(now, elapsed, counts) {
  if (lastFrameAt > 0) {
    const delta = now - lastFrameAt;
    if (delta > 0) {
      recentFrameTimes.push(delta);
      if (recentFrameTimes.length > 120) recentFrameTimes.shift();
      const mean = recentFrameTimes.reduce((sum, value) => sum + value, 0) / recentFrameTimes.length;
      currentFps = 1000 / mean;
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
  hud.glasses.textContent = String(counts.glasses);
  hud.pours.textContent = String(counts.pours);
}

function advanceModels(now) {
  for (const model of models) model.advanceAfterFrame(now);
  invalids = invalids.filter((item) => now - item.started < INVALID_MS);
  if (hint && now - hint.started >= HINT_ATTENTION_MS) hint = null;
}

function draw(now) {
  let elapsed = now - cycleStarted;
  if (elapsed >= CYCLE_MS) {
    startCycle(now);
    elapsed = 0;
  }

  consumeEvents(now);
  const pairFrames = composeFrames(now);
  fixMovingPoses(pairFrames);
  for (let i = 0; i < 10; i++) glassViews[i].update(glassFrames[i]);
  updateDrawOrder();
  app.renderer.render(app.stage);
  advanceModels(now);

  const counts = activeCounts(now);
  updateStats(now, elapsed, counts);
  requestAnimationFrame(draw);
}

startCycle(performance.now());
requestAnimationFrame(draw);
