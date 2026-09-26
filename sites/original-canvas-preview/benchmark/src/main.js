import {
  H, W, STRESS_H, STRESS_W, clamp01,
  invalidPose, movingPose, position, pourDirection,
  pouringLip, selectedPose, smooth, streamControl,
  stressInvalidPose, stressMovingPose, stressPosition,
  stressPourDirection, stressSelectedPose,
} from './geometry.js';
import { CAPACITY, COLORS, clone, pour } from './puzzle.js';
import { BenchmarkStats } from './benchmark.js';

// Exact original two-glass state, bottom-to-top color indices.
const INITIAL_BASELINE = [
  [2, 0, 3],
  [3],
];

// Five independent compatible pairs make repeated concurrent transfers valid.
// Each pair can deterministically pour forward, reverse, then forward again.
const INITIAL_STRESS = [
  [0, 0], [0],
  [1, 1], [1],
  [2, 2], [2],
  [3, 3], [3],
  [0, 0], [0],
];

// Original animation/render constants. These are intentionally unchanged.
const POUR_MS = 1040;
const SELECT_MS = 300;
const INVALID_MS = 420;
const SETTLE_MS = 440;
const HINT_ATTENTION_MS = 680;
const TRANSFER_START = 0.30;
const TRANSFER_END = 0.69;
const GLASS_HALF = 33;
const GLASS_BOTTOM = 156;
const LIQUID_BAND = 33;
const LIQUID_TOP_BASELINE = 148;
const EPSILON = 0.0001;

const MODE_CONFIG = {
  '2-glass': {
    count: 2,
    width: W,
    height: H,
    initial: INITIAL_BASELINE,
    position,
    movingPose,
    selectedPose,
    invalidPose,
    direction: pourDirection,
  },
  '10-glass': {
    count: 10,
    width: STRESS_W,
    height: STRESS_H,
    initial: INITIAL_STRESS,
    position: stressPosition,
    movingPose: stressMovingPose,
    selectedPose: stressSelectedPose,
    invalidPose: stressInvalidPose,
    direction: stressPourDirection,
  },
};

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('.stage');
const hitGlasses = document.querySelector('.hit-glasses');
const baselineButton = document.querySelector('[data-mode="2-glass"]');
const stressButton = document.querySelector('[data-mode="10-glass"]');
const startButton = document.querySelector('[data-action="start"]');
const restartButton = document.querySelector('[data-action="restart"]');
const summary = document.querySelector('.summary');
const overlay = {
  mode: document.querySelector('[data-live="mode"]'),
  elapsed: document.querySelector('[data-live="elapsed"]'),
  fps: document.querySelector('[data-live="fps"]'),
  frameMs: document.querySelector('[data-live="frame-ms"]'),
  activeGlasses: document.querySelector('[data-live="active-glasses"]'),
  activePours: document.querySelector('[data-live="active-pours"]'),
};

let currentMode = '2-glass';
let board = clone(INITIAL_BASELINE);
let selected = null;
let activeFlights = [];
let invalidMotions = [];
let selectionPulse = null;
let settleMotions = [];
let hint = null;
let raf = 0;
let framePending = false;

const config = () => MODE_CONFIG[currentMode];

const benchmark = new BenchmarkStats({
  onOverlay: (live) => {
    overlay.mode.textContent = live.mode;
    overlay.elapsed.textContent = `${(live.elapsedMs / 1000).toFixed(2)} s`;
    overlay.fps.textContent = Number.isFinite(live.fps) ? live.fps.toFixed(1) : '—';
    overlay.frameMs.textContent = Number.isFinite(live.frameMs) ? `${live.frameMs.toFixed(2)} ms` : '—';
    overlay.activeGlasses.textContent = String(live.activeGlasses);
    overlay.activePours.textContent = String(live.activePours);
  },
  onComplete: (result) => {
    summary.hidden = false;
    summary.textContent = JSON.stringify(result, null, 2);
  },
});

const outline = () => {
  ctx.beginPath();
  ctx.moveTo(-GLASS_HALF, 0);
  ctx.lineTo(-GLASS_HALF, 130);
  ctx.quadraticCurveTo(-GLASS_HALF, 154, -12, GLASS_BOTTOM);
  ctx.lineTo(12, GLASS_BOTTOM);
  ctx.quadraticCurveTo(GLASS_HALF, 154, GLASS_HALF, 130);
  ctx.lineTo(GLASS_HALF, 0);
};

const rim = () => {
  ctx.beginPath();
  ctx.ellipse(0, 0, GLASS_HALF, 4.5, 0, 0, Math.PI * 2);
};

const glassPath = () => {
  const path = new Path2D();
  path.moveTo(-GLASS_HALF, 0);
  path.lineTo(-GLASS_HALF, 130);
  path.quadraticCurveTo(-GLASS_HALF, 154, -12, GLASS_BOTTOM);
  path.lineTo(12, GLASS_BOTTOM);
  path.quadraticCurveTo(GLASS_HALF, 154, GLASS_HALF, 130);
  path.lineTo(GLASS_HALF, 0);
  path.closePath();
  return path;
};

const vesselPolygon = (angle) => [
  [-GLASS_HALF, 0], [GLASS_HALF, 0], [GLASS_HALF, 130], [30, 143], [22, 151], [12, GLASS_BOTTOM],
  [-12, GLASS_BOTTOM], [-22, 151], [-30, 143], [-GLASS_HALF, 130],
].map(([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]);

const polygonArea = (points) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point[0] * next[1] - point[1] * next[0];
}, 0) / 2);

const belowArea = (points, line) => {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (a[1] >= line) out.push(a);
    if ((a[1] >= line) !== (b[1] >= line)) {
      const t = (line - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), line]);
    }
  }
  return polygonArea(out);
};

const BASE_POLY = vesselPolygon(0);
const BASE_AREA = polygonArea(BASE_POLY);
const liquidTop = (units) => LIQUID_TOP_BASELINE - units * LIQUID_BAND;
const canonicalArea = (units) => {
  if (units <= 0) return 0;
  const clamped = Math.min(CAPACITY, units), whole = Math.floor(clamped), fraction = clamped - whole;
  const areaAt = (count) => count <= 0 ? 0 : belowArea(BASE_POLY, liquidTop(count));
  const a0 = areaAt(whole), a1 = areaAt(Math.min(CAPACITY, whole + 1));
  return a0 + (a1 - a0) * fraction;
};

const damped = (phase, decay) => Math.sin(phase) * Math.exp(-decay);
const transferAt = (progress) => smooth((progress - TRANSFER_START) / (TRANSFER_END - TRANSFER_START));

function sourceSlosh(p, direction) {
  const outward = -direction * 0.052 * Math.sin(Math.PI * clamp01(p / 0.29));
  const pourSettle = direction * 0.012 * Math.sin((p - 0.24) * Math.PI * 8) * Math.sin(Math.PI * clamp01((p - 0.20) / 0.54));
  const returning = direction * 0.048 * Math.sin(Math.PI * clamp01((p - 0.69) / 0.31));
  return outward + pourSettle + returning;
}

function receiverSlosh(p, direction) {
  if (p <= TRANSFER_START || p >= TRANSFER_END + 0.06) return 0;
  const q = clamp01((p - TRANSFER_START) / (TRANSFER_END - TRANSFER_START));
  return direction * 0.020 * Math.sin(q * Math.PI * 5.2) * Math.sin(q * Math.PI);
}

function liquidLevel(units, relativeAngle) {
  const poly = vesselPolygon(relativeAngle);
  const minY = Math.min(...poly.map((point) => point[1]));
  const maxY = Math.max(...poly.map((point) => point[1]));
  if (units <= 0) return maxY;
  const targetArea = Math.min(BASE_AREA, canonicalArea(units));
  let low = minY, high = maxY;
  for (let i = 0; i < 21; i++) {
    const mid = (low + high) / 2;
    if (belowArea(poly, mid) > targetArea) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function drawDynamicLiquid(layers, vesselAngle, surfaceAngle, wave, phase) {
  const relative = vesselAngle - surfaceAngle;
  ctx.rotate(-vesselAngle + surfaceAngle);
  let total = 0;
  const visible = layers.filter((layer) => layer.amount > EPSILON);
  visible.forEach((layer, layerIndex) => {
    const bottom = liquidLevel(total, relative);
    total += layer.amount;
    const top = liquidLevel(total, relative);
    const isTop = layerIndex === visible.length - 1;
    ctx.fillStyle = COLORS[layer.color];
    if (isTop && wave > 0.05) {
      ctx.beginPath();
      const minX = -220, maxX = 220, segments = 44;
      for (let i = 0; i <= segments; i++) {
        const x = minX + (maxX - minX) * i / segments;
        const y = top + Math.sin(x / 17 + phase) * wave;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(maxX, bottom + 2);
      ctx.lineTo(minX, bottom + 2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const x = minX + (maxX - minX) * i / segments;
        const y = top + Math.sin(x / 17 + phase) * wave;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = 1.45;
      ctx.stroke();
    } else {
      ctx.fillRect(-220, top, 440, bottom - top + 1);
      ctx.fillStyle = '#ffffff3f';
      ctx.fillRect(-220, top, 440, 1.4);
    }
  });
  ctx.rotate(vesselAngle - surfaceAngle);
}

function schedule() {
  if (framePending) return;
  framePending = true;
  raf = requestAnimationFrame(draw);
}

function flightForGlass(index) {
  return activeFlights.find((flight) => flight.source === index || flight.target === index) || null;
}

function liquidLayers(index, flight, transfer) {
  if (!flight) return board[index].map((color) => ({ color, amount: 1 }));

  if (index === flight.source) {
    const layers = flight.beforeSource.map((color) => ({ color, amount: 1 }));
    let remaining = flight.amount * transfer;
    for (let layer = layers.length - 1; layer >= 0 && remaining > EPSILON; layer--) {
      const taken = Math.min(remaining, layers[layer].amount);
      layers[layer].amount -= taken;
      remaining -= taken;
    }
    return layers;
  }

  if (index === flight.target) {
    return [
      ...flight.beforeTarget.map((color) => ({ color, amount: 1 })),
      { color: flight.color, amount: flight.amount * transfer },
    ];
  }

  return board[index].map((color) => ({ color, amount: 1 }));
}

function drawVessel(index, now, moving = false, forcedFlight = null) {
  const layout = config();
  const home = layout.position(index);
  const flight = forcedFlight || flightForGlass(index);
  const invalid = invalidMotions.find((motion) => motion.source === index) || null;
  const settling = !flight
    ? settleMotions.find((motion) => motion.source === index || motion.target === index) || null
    : null;

  const progress = flight ? clamp01((now - flight.started) / POUR_MS) : 0;
  const transfer = flight ? transferAt(progress) : 0;
  const invalidProgress = invalid ? clamp01((now - invalid.started) / INVALID_MS) : 0;
  const pulseProgress = selectionPulse?.index === index
    ? clamp01((now - selectionPulse.started) / SELECT_MS)
    : 1;
  const settleProgress = settling ? clamp01((now - settling.started) / SETTLE_MS) : 0;
  const hintProgress = hint ? clamp01((now - hint.started) / HINT_ATTENTION_MS) : 1;
  const activeDirection = flight ? layout.direction(flight.source, flight.target) : 1;

  let pose = { ...home, angle: 0 };
  let surfaceAngle = 0;
  let wave = 0;
  let phase = now * 0.018;
  let dynamicLiquid = false;
  const layers = liquidLayers(index, flight, transfer);

  if (moving && flight && index === flight.source) {
    const remainingUnits = flight.beforeSource.length - flight.amount * transfer;
    pose = layout.movingPose(flight.source, flight.target, progress, remainingUnits);
    surfaceAngle = sourceSlosh(progress, activeDirection);
    wave = 0.7 + 1.7 * Math.abs(Math.sin(progress * Math.PI * 4.2)) * Math.sin(Math.PI * clamp01(progress / 0.92));
    dynamicLiquid = true;
  } else if (invalid) {
    pose = layout.invalidPose(index, invalidProgress, invalid.direction);
    const envelope = Math.pow(1 - invalidProgress, 1.15);
    surfaceAngle = -invalid.direction * 0.065 * Math.sin((invalidProgress - 0.065) * Math.PI * 5.4) * envelope;
    wave = 2.4 * Math.abs(Math.sin(invalidProgress * Math.PI * 4.8)) * envelope;
    phase += invalidProgress * 4;
    dynamicLiquid = true;
  } else if (selected === index) {
    pose = layout.selectedPose(index, selectionPulse?.index === index ? pulseProgress : 1);
    if (selectionPulse?.index === index && pulseProgress < 1) {
      surfaceAngle = 0.018 * damped(pulseProgress * Math.PI * 4.5, pulseProgress * 2.4);
      wave = 1.65 * Math.sin(Math.PI * pulseProgress) * Math.exp(-pulseProgress * 0.8);
      dynamicLiquid = true;
    }
  }

  if (!moving && !invalid && hint && (hint.source === index || hint.target === index) && hintProgress < 1) {
    const lift = Math.sin(Math.PI * hintProgress);
    const hintPhase = hintProgress * Math.PI * 4;
    const hintDirection = hint.source === index ? -1 : 1;
    pose.y -= 7 * lift;
    pose.x += hintDirection * 1.6 * Math.sin(hintPhase) * lift;
  }

  if (flight && index === flight.target && progress > TRANSFER_START && progress < 0.82) {
    surfaceAngle += receiverSlosh(progress, activeDirection);
    const flowEnvelope = Math.sin(Math.PI * clamp01((progress - TRANSFER_START) / (0.82 - TRANSFER_START)));
    wave = Math.max(wave, 0.35 + 1.9 * Math.max(0, flowEnvelope));
    phase -= transfer * 5;
    dynamicLiquid = true;
  }

  if (!flight && settling) {
    const env = Math.exp(-settleProgress * 3.2);
    const sign = index === settling.target ? -1 : 1;
    surfaceAngle += sign * settling.direction * 0.036 * Math.sin(settleProgress * Math.PI * 5.5) * env;
    wave = Math.max(wave, (index === settling.target ? 2.0 : 1.2) * Math.abs(Math.sin(settleProgress * Math.PI * 4.4)) * env);
    phase += settleProgress * 5;
    dynamicLiquid = true;
  }

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  const path = glassPath();
  ctx.fillStyle = 'rgba(12,31,42,.78)';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 7;
  ctx.fill(path);
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.clip(path);
  if (dynamicLiquid || Math.abs(pose.angle) > 0.002) {
    drawDynamicLiquid(layers, pose.angle, surfaceAngle, wave, phase);
  } else {
    let total = 0;
    for (const layer of layers) {
      if (layer.amount <= EPSILON) continue;
      const bottom = total === 0 ? GLASS_BOTTOM + 2 : liquidTop(total);
      total += layer.amount;
      const top = liquidTop(total);
      ctx.fillStyle = COLORS[layer.color];
      ctx.fillRect(-40, top, 80, bottom - top + 1);
      ctx.fillStyle = '#ffffff3f';
      ctx.fillRect(-40, top, 80, 1.4);
    }
  }

  const shine = ctx.createLinearGradient(-34, 0, 34, 0);
  shine.addColorStop(0, '#ffffff38');
  shine.addColorStop(.18, '#ffffff07');
  shine.addColorStop(.86, '#ffffff00');
  shine.addColorStop(1, '#ffffff34');
  ctx.fillStyle = shine;
  ctx.fillRect(-34, 0, 68, 158);
  ctx.restore();

  const invalidSourceNow = Boolean(invalid);
  const invalidTargetNow = invalidMotions.some((motion) => motion.target === index);
  const hintedSource = !moving && hint?.source === index;
  const hintedTarget = !moving && hint?.target === index;
  const selectedNow = selected === index;
  const emphasis = invalidSourceNow || invalidTargetNow
    ? '#ff8e94'
    : hintedSource ? '#f5d38e'
      : hintedTarget ? '#83e0d4'
        : selectedNow ? '#f5d38e'
          : null;

  if (emphasis) {
    ctx.save();
    ctx.strokeStyle = emphasis;
    ctx.lineWidth = invalidSourceNow || invalidTargetNow ? 3 : 2.4;
    ctx.shadowColor = emphasis;
    ctx.shadowBlur = invalidSourceNow || invalidTargetNow ? 12 : 16;
    outline(); ctx.stroke(); rim(); ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = invalidSourceNow || invalidTargetNow ? '#ff8e94' : selectedNow ? '#f5d38e' : '#c8e1ed9b';
  ctx.lineWidth = invalidSourceNow || invalidTargetNow ? 3 : 1.6;
  outline(); ctx.stroke();
  rim();
  ctx.strokeStyle = invalidSourceNow || invalidTargetNow ? '#ffb0b5' : selectedNow ? '#f9e1ae' : '#e6f3f8c7';
  ctx.lineWidth = selectedNow ? 1.8 : 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-25, 14); ctx.lineTo(-25, 123);
  ctx.strokeStyle = '#ffffff52'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  return pose;
}

function streamIsVisible(flight, now) {
  const progress = clamp01((now - flight.started) / POUR_MS);
  return progress > TRANSFER_START - 0.025 && progress < TRANSFER_END + 0.025;
}

function drawStream(flight, moving, now) {
  const layout = config();
  const progress = clamp01((now - flight.started) / POUR_MS);
  if (!moving || !streamIsVisible(flight, now)) return;

  const transfer = transferAt(progress);
  const direction = layout.direction(flight.source, flight.target);
  const lip = pouringLip(moving, direction);
  const destination = layout.position(flight.target);
  const targetUnits = flight.beforeTarget.length + flight.amount * transfer;
  const end = { x: destination.x, y: destination.y + liquidTop(targetUnits) + 1 };
  const control = streamControl(lip, end, direction);
  const q = clamp01((progress - (TRANSFER_START - 0.025)) / (TRANSFER_END - TRANSFER_START + 0.05));
  const fade = Math.min(1, q * 7, (1 - q) * 7);

  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.beginPath();
  ctx.moveTo(lip.x, lip.y);
  ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
  ctx.strokeStyle = COLORS[flight.color];
  ctx.lineWidth = 5.8;
  ctx.lineCap = 'round';
  ctx.shadowColor = COLORS[flight.color];
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha *= 0.38;
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  const impact = Math.sin(Math.PI * transfer);
  if (impact > 0) {
    ctx.globalAlpha = 0.24 * impact;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(end.x, end.y + 1.5, 9 + impact * 4, 2.2 + impact, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function renderScene(now) {
  const layout = config();
  ctx.setTransform(canvas.width / layout.width, 0, 0, canvas.height / layout.height, 0, 0);
  ctx.clearRect(0, 0, layout.width, layout.height);

  const movingSources = new Set(activeFlights.map((flight) => flight.source));
  for (let index = 0; index < layout.count; index++) {
    if (!movingSources.has(index)) drawVessel(index, now);
  }

  const movingPoses = new Map();
  for (const flight of activeFlights) {
    movingPoses.set(flight, drawVessel(flight.source, now, true, flight));
  }
  for (const flight of activeFlights) drawStream(flight, movingPoses.get(flight), now);
}

function clearSelection() {
  selected = null;
  selectionPulse = null;
}

function glassInActiveFlight(index) {
  return activeFlights.some((flight) => flight.source === index || flight.target === index);
}

function glassInInvalid(index) {
  return invalidMotions.some((motion) => motion.source === index || motion.target === index);
}

function launchFlight(source, target, result, started) {
  const beforeSource = [...board[source]];
  const beforeTarget = [...board[target]];
  const direction = config().direction(source, target);
  settleMotions = settleMotions.filter((motion) => (
    motion.source !== source && motion.target !== source
    && motion.source !== target && motion.target !== target
  ));
  clearSelection();
  activeFlights.push({
    source,
    target,
    beforeSource,
    beforeTarget,
    amount: result.amount,
    color: result.color,
    started,
    direction,
  });
  board = result.board;
  schedule();
  return true;
}

function startPour(source, target, started = performance.now()) {
  if (glassInActiveFlight(source) || glassInActiveFlight(target)) return false;
  if (glassInInvalid(source) || glassInInvalid(target)) return false;
  const result = pour(board, source, target);
  if (!result) return false;
  return launchFlight(source, target, result, started);
}

function triggerSelection(index, started = performance.now(), benchmarkOnly = false) {
  if (!board[index]?.length) return false;
  if (!benchmarkOnly && (activeFlights.length || invalidMotions.length)) return false;
  if (benchmarkOnly && (glassInActiveFlight(index) || glassInInvalid(index))) return false;
  settleMotions = settleMotions.filter((motion) => motion.source !== index && motion.target !== index);
  selected = index;
  selectionPulse = { index, started };
  hint = null;
  schedule();
  return true;
}

function triggerHint(source, target, started = performance.now(), benchmarkOnly = false) {
  if (!benchmarkOnly && (activeFlights.length || invalidMotions.length)) return false;
  hint = { source, target, started };
  schedule();
  return true;
}

function triggerInvalid(source, target, started = performance.now(), benchmarkOnly = false) {
  if (!benchmarkOnly && (activeFlights.length || invalidMotions.length)) return false;
  if (benchmarkOnly && (
    glassInActiveFlight(source) || glassInActiveFlight(target)
    || glassInInvalid(source) || glassInInvalid(target)
  )) return false;

  clearSelection();
  settleMotions = settleMotions.filter((motion) => (
    motion.source !== source && motion.target !== source
    && motion.source !== target && motion.target !== target
  ));
  const sourcePosition = config().position(source);
  const targetPosition = config().position(target);
  const direction = targetPosition.x >= sourcePosition.x ? 1 : -1;
  invalidMotions.push({ source, target, direction, started });
  schedule();
  return true;
}

function choose(index) {
  if (currentMode !== '2-glass' || benchmark.running) return;
  if (activeFlights.length || invalidMotions.length) return;
  const source = selected;

  if (source === null) {
    if (board[index].length) {
      settleMotions = [];
      selected = index;
      selectionPulse = { index, started: performance.now() };
      hint = null;
      schedule();
    }
    return;
  }

  if (source === index) {
    clearSelection();
    schedule();
    return;
  }

  const result = pour(board, source, index);
  if (!result) {
    clearSelection();
    settleMotions = [];
    triggerInvalid(source, index, performance.now(), false);
    return;
  }

  settleMotions = [];
  launchFlight(source, index, result, performance.now());
}

function advanceAnimations(now) {
  const continuingFlights = [];
  for (const flight of activeFlights) {
    const progress = clamp01((now - flight.started) / POUR_MS);
    if (progress < 1) {
      continuingFlights.push(flight);
    } else {
      settleMotions.push({
        source: flight.source,
        target: flight.target,
        direction: flight.direction,
        started: now,
      });
    }
  }
  activeFlights = continuingFlights;

  invalidMotions = invalidMotions.filter((motion) => clamp01((now - motion.started) / INVALID_MS) < 1);

  if (selectionPulse && clamp01((now - selectionPulse.started) / SELECT_MS) >= 1) {
    selectionPulse = null;
  }

  settleMotions = settleMotions.filter((motion) => clamp01((now - motion.started) / SETTLE_MS) < 1);

  if (hint && clamp01((now - hint.started) / HINT_ATTENTION_MS) >= 1) {
    hint = null;
  }
}

function activityAt(now) {
  const animated = new Set();
  for (const flight of activeFlights) {
    animated.add(flight.source);
    animated.add(flight.target);
  }
  for (const motion of invalidMotions) {
    animated.add(motion.source);
    animated.add(motion.target);
  }
  for (const motion of settleMotions) {
    animated.add(motion.source);
    animated.add(motion.target);
  }
  if (selectionPulse) animated.add(selectionPulse.index);
  if (hint) {
    animated.add(hint.source);
    animated.add(hint.target);
  }
  const activeStreams = activeFlights.filter((flight) => streamIsVisible(flight, now)).length;
  return {
    activeGlasses: animated.size,
    activePours: activeFlights.length,
    activeStreams,
  };
}

function hasMotion() {
  return activeFlights.length > 0
    || invalidMotions.length > 0
    || Boolean(selectionPulse)
    || settleMotions.length > 0
    || Boolean(hint);
}

function dispatchBenchmarkEvent(event, now) {
  if (event.type === 'selection') {
    triggerSelection(event.index, now, true);
    return;
  }

  if (event.type === 'hint') {
    if (triggerHint(event.source, event.target, now, true)) benchmark.noteHint();
    return;
  }

  if (event.type === 'invalid') {
    if (triggerInvalid(event.source, event.target, now, true)) benchmark.noteInvalid();
    return;
  }

  if (event.type === 'pours') {
    let started = 0;
    for (const [source, target] of event.pairs) {
      if (startPour(source, target, now)) started += 1;
    }
    if (started) benchmark.noteScriptedPours(started);
  }
}

function draw(now = performance.now()) {
  framePending = false;
  const measuring = benchmark.running;
  let updateCpuMs = 0;

  if (measuring) {
    benchmark.beginFrame(now);
    const eventStart = performance.now();
    for (const event of benchmark.consumeEvents(now)) dispatchBenchmarkEvent(event, now);
    updateCpuMs += performance.now() - eventStart;
  }

  const renderStart = measuring ? performance.now() : 0;
  renderScene(now);
  if (measuring) {
    benchmark.recordRender(performance.now() - renderStart);
    benchmark.markRendered();
  }

  const lifecycleStart = measuring ? performance.now() : 0;
  advanceAnimations(now);
  if (measuring) {
    updateCpuMs += performance.now() - lifecycleStart;
    benchmark.recordUpdate(updateCpuMs);
    const activity = activityAt(now);
    benchmark.sampleActivity(activity);
    benchmark.updateOverlay(now, activity);
    if (benchmark.shouldFinish(now) && !hasMotion()) benchmark.complete(now);
  }

  if (benchmark.running || hasMotion()) schedule();
}

function clearSummary() {
  summary.hidden = true;
  summary.textContent = '';
}

function updateIdleOverlay() {
  overlay.mode.textContent = currentMode;
  overlay.elapsed.textContent = '0.00 s';
  overlay.fps.textContent = '—';
  overlay.frameMs.textContent = '—';
  overlay.activeGlasses.textContent = '0';
  overlay.activePours.textContent = '0';
}

function renderHitTargets() {
  hitGlasses.replaceChildren();
  if (currentMode !== '2-glass') return;

  const layout = config();
  for (let index = 0; index < layout.count; index++) {
    const home = layout.position(index);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.glass = String(index);
    button.setAttribute('aria-label', `Glass ${index + 1}`);
    button.style.left = `${((home.x - GLASS_HALF) / layout.width) * 100}%`;
    button.style.top = `${(home.y / layout.height) * 100}%`;
    button.style.width = `${((GLASS_HALF * 2) / layout.width) * 100}%`;
    button.style.height = `${(GLASS_BOTTOM / layout.height) * 100}%`;
    button.addEventListener('click', () => choose(index));
    hitGlasses.append(button);
  }
}

function configureStage() {
  const layout = config();
  stage.style.aspectRatio = `${layout.width} / ${layout.height}`;
  stage.style.maxWidth = currentMode === '2-glass' ? '400px' : '960px';
  stage.setAttribute('aria-label', currentMode === '2-glass'
    ? 'STILLLIGHT original two-glass Canvas baseline'
    : 'STILLLIGHT original Canvas ten-glass stress benchmark');
  baselineButton.setAttribute('aria-pressed', String(currentMode === '2-glass'));
  stressButton.setAttribute('aria-pressed', String(currentMode === '10-glass'));
  renderHitTargets();
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const density = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * density));
  canvas.height = Math.max(1, Math.round(rect.height * density));
  schedule();
}

function resetScene() {
  cancelAnimationFrame(raf);
  framePending = false;
  board = clone(config().initial);
  selected = null;
  activeFlights = [];
  invalidMotions = [];
  selectionPulse = null;
  settleMotions = [];
  hint = null;
  configureStage();
  resize();
}

function setMode(mode) {
  if (!MODE_CONFIG[mode]) return;
  benchmark.cancel();
  currentMode = mode;
  clearSummary();
  updateIdleOverlay();
  resetScene();
}

function startBenchmark() {
  benchmark.cancel();
  clearSummary();
  resetScene();
  const now = performance.now();
  benchmark.start(currentMode, now);
  schedule();
}

function restart() {
  benchmark.cancel();
  clearSummary();
  updateIdleOverlay();
  resetScene();
}

function showManualHint() {
  if (currentMode !== '2-glass' || benchmark.running) return;
  triggerHint(0, 1, performance.now(), false);
}

function showManualInvalid() {
  if (currentMode !== '2-glass' || benchmark.running) return;
  triggerInvalid(0, 1, performance.now(), false);
}

function startManualPour() {
  if (currentMode !== '2-glass' || benchmark.running) return false;
  if (activeFlights.length || invalidMotions.length) return false;
  return startPour(0, 1, performance.now());
}

baselineButton.addEventListener('click', () => setMode('2-glass'));
stressButton.addEventListener('click', () => setMode('10-glass'));
startButton.addEventListener('click', startBenchmark);
restartButton.addEventListener('click', restart);
new ResizeObserver(resize).observe(stage);

window.addEventListener('keydown', (event) => {
  if (event.repeat || currentMode !== '2-glass' || benchmark.running) return;
  if (event.key.toLowerCase() === 'h') showManualHint();
  if (event.key.toLowerCase() === 'i') showManualInvalid();
  if (event.key.toLowerCase() === 'r') restart();
  if (event.key.toLowerCase() === 'p') startManualPour();
});

window.__STILLLIGHT_ORIGINAL_CANVAS_BENCHMARK__ = {
  setMode,
  startBenchmark,
  restart,
  baseline: {
    hint: showManualHint,
    invalid: showManualInvalid,
    pour: startManualPour,
    choose,
  },
  state: () => ({
    mode: currentMode,
    board: clone(board),
    selected,
    activePours: activeFlights.length,
    benchmarkRunning: benchmark.running,
  }),
  constants: {
    POUR_MS,
    SELECT_MS,
    INVALID_MS,
    SETTLE_MS,
    HINT_ATTENTION_MS,
    TRANSFER_START,
    TRANSFER_END,
  },
};

updateIdleOverlay();
resetScene();
