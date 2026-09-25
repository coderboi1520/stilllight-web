import {
  H, W, clamp01, invalidPose, movingPose, position, pourDirection,
  pouringLip, selectedPose, smooth, streamControl,
} from './geometry.js';
import { CAPACITY, COLORS, clone, pour } from './puzzle.js';

// Golden-reference state: exactly two glasses, bottom-to-top color indices.
const INITIAL = [
  [2, 0, 3],
  [3],
];

// Original animation/render constants. Do not retune in the golden reference.
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

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const buttons = [...document.querySelectorAll('[data-glass]')];

let board = clone(INITIAL);
let selected = null;
let busy = false;
let flight = null;
let invalidMotion = null;
let selectionPulse = null;
let settleMotion = null;
let hint = null;
let invalidSource = null;
let invalidTarget = null;
let raf = 0;
let framePending = false;

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

function draw(now = performance.now()) {
  framePending = false;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const active = flight;
  const invalid = invalidMotion;
  const pulse = selectionPulse;
  const settling = settleMotion;
  const progress = active ? clamp01((now - active.started) / POUR_MS) : 0;
  const transfer = active ? transferAt(progress) : 0;
  const invalidProgress = invalid ? clamp01((now - invalid.started) / INVALID_MS) : 0;
  const pulseProgress = pulse ? clamp01((now - pulse.started) / SELECT_MS) : 0;
  const settleProgress = settling ? clamp01((now - settling.started) / SETTLE_MS) : 0;
  const hintProgress = hint ? clamp01((now - hint.started) / HINT_ATTENTION_MS) : 1;
  const activeDirection = active ? pourDirection(active.source, active.target) : 1;

  function drawVessel(index, moving = false) {
    const home = position(index);
    let pose = { ...home, angle: 0 };
    let surfaceAngle = 0;
    let wave = 0;
    let phase = now * 0.018;
    let dynamicLiquid = false;

    let layers = (active ? active.before : board)[index].map((color) => ({ color, amount: 1 }));
    if (active && index === active.source) {
      let remaining = active.amount * transfer;
      for (let layer = layers.length - 1; layer >= 0 && remaining > EPSILON; layer--) {
        const taken = Math.min(remaining, layers[layer].amount);
        layers[layer].amount -= taken;
        remaining -= taken;
      }
    }
    if (active && index === active.target) layers = [...layers, { color: active.color, amount: active.amount * transfer }];

    if (moving && active) {
      const remainingUnits = active.before[active.source].length - active.amount * transfer;
      pose = movingPose(active.source, active.target, progress, remainingUnits);
      surfaceAngle = sourceSlosh(progress, activeDirection);
      wave = 0.7 + 1.7 * Math.abs(Math.sin(progress * Math.PI * 4.2)) * Math.sin(Math.PI * clamp01(progress / 0.92));
      dynamicLiquid = true;
    } else if (invalid && index === invalid.source) {
      pose = invalidPose(index, invalidProgress, invalid.direction);
      const envelope = Math.pow(1 - invalidProgress, 1.15);
      surfaceAngle = -invalid.direction * 0.065 * Math.sin((invalidProgress - 0.065) * Math.PI * 5.4) * envelope;
      wave = 2.4 * Math.abs(Math.sin(invalidProgress * Math.PI * 4.8)) * envelope;
      phase += invalidProgress * 4;
      dynamicLiquid = true;
    } else if (selected === index) {
      pose = selectedPose(index, pulse?.index === index ? pulseProgress : 1);
      if (pulse?.index === index && pulseProgress < 1) {
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

    if (active && index === active.target && progress > TRANSFER_START && progress < 0.82) {
      surfaceAngle += receiverSlosh(progress, activeDirection);
      const flowEnvelope = Math.sin(Math.PI * clamp01((progress - TRANSFER_START) / (0.82 - TRANSFER_START)));
      wave = Math.max(wave, 0.35 + 1.9 * Math.max(0, flowEnvelope));
      phase -= transfer * 5;
      dynamicLiquid = true;
    }

    if (!active && settling && (index === settling.source || index === settling.target)) {
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

    const invalidSourceNow = invalidSource === index;
    const invalidTargetNow = invalidTarget === index;
    const hintedSource = !moving && hint?.source === index;
    const hintedTarget = !moving && hint?.target === index;
    const selectedNow = selected === index;
    const emphasis = invalidSourceNow || invalidTargetNow ? '#ff8e94' : hintedSource ? '#f5d38e' : hintedTarget ? '#83e0d4' : selectedNow ? '#f5d38e' : null;
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

  for (let index = 0; index < 2; index++) if (index !== active?.source) drawVessel(index);
  const moving = active ? drawVessel(active.source, true) : undefined;

  if (active && moving && progress > TRANSFER_START - 0.025 && progress < TRANSFER_END + 0.025) {
    const direction = activeDirection;
    const lip = pouringLip(moving, direction);
    const destination = position(active.target);
    const targetUnits = active.before[active.target].length + active.amount * transfer;
    const end = { x: destination.x, y: destination.y + liquidTop(targetUnits) + 1 };
    const control = streamControl(lip, end, direction);
    const q = clamp01((progress - (TRANSFER_START - 0.025)) / (TRANSFER_END - TRANSFER_START + 0.05));
    const fade = Math.min(1, q * 7, (1 - q) * 7);

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.beginPath();
    ctx.moveTo(lip.x, lip.y);
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
    ctx.strokeStyle = COLORS[active.color];
    ctx.lineWidth = 5.8;
    ctx.lineCap = 'round';
    ctx.shadowColor = COLORS[active.color];
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

  let continueFrames = false;

  if (active) {
    if (progress < 1) continueFrames = true;
    else {
      flight = null;
      busy = false;
      settleMotion = { source: active.source, target: active.target, direction: activeDirection, started: now };
      continueFrames = true;
    }
  }

  if (invalid) {
    if (invalidProgress < 1) continueFrames = true;
    else {
      invalidMotion = null;
      invalidSource = null;
      invalidTarget = null;
      busy = false;
      continueFrames = true;
    }
  }

  if (pulse) {
    if (pulseProgress < 1) continueFrames = true;
    else { selectionPulse = null; continueFrames = true; }
  }

  if (settling && !active) {
    if (settleProgress < 1) continueFrames = true;
    else { settleMotion = null; continueFrames = true; }
  }

  if (hint && hintProgress < 1) continueFrames = true;
  else if (hint && hintProgress >= 1) { hint = null; continueFrames = true; }

  if (continueFrames) schedule();
}

function clearSelection() {
  selected = null;
  selectionPulse = null;
}

function choose(index) {
  if (flight || invalidMotion || busy) return;
  const source = selected;

  if (source === null) {
    if (board[index].length) {
      settleMotion = null;
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
    const direction = position(index).x >= position(source).x ? 1 : -1;
    clearSelection();
    settleMotion = null;
    invalidSource = source;
    invalidTarget = index;
    invalidMotion = { source, target: index, direction, started: performance.now() };
    busy = true;
    schedule();
    return;
  }

  const before = clone(board);
  const started = performance.now();
  clearSelection();
  settleMotion = null;
  invalidSource = null;
  invalidTarget = null;
  flight = { source, target: index, before, amount: result.amount, color: result.color, started };
  board = result.board;
  busy = true;
  schedule();
}

function reset() {
  cancelAnimationFrame(raf);
  framePending = false;
  board = clone(INITIAL);
  selected = null;
  busy = false;
  flight = null;
  invalidMotion = null;
  selectionPulse = null;
  settleMotion = null;
  hint = null;
  invalidSource = null;
  invalidTarget = null;
  resize();
}

function showHint() {
  if (busy) return;
  hint = { source: 0, target: 1, started: performance.now() };
  schedule();
}

function forceInvalid() {
  if (busy) return;
  clearSelection();
  invalidSource = 0;
  invalidTarget = 1;
  invalidMotion = { source: 0, target: 1, direction: 1, started: performance.now() };
  busy = true;
  schedule();
}

function startPour() {
  if (busy) return false;
  const result = pour(board, 0, 1);
  if (!result) return false;
  const before = clone(board);
  flight = { source: 0, target: 1, before, amount: result.amount, color: result.color, started: performance.now() };
  board = result.board;
  selected = null;
  busy = true;
  settleMotion = null;
  schedule();
  return true;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const density = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * density));
  canvas.height = Math.max(1, Math.round(rect.height * density));
  schedule();
}

buttons.forEach((button) => button.addEventListener('click', () => choose(Number(button.dataset.glass))));
new ResizeObserver(resize).observe(canvas);
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.key.toLowerCase() === 'h') showHint();
  if (event.key.toLowerCase() === 'i') forceInvalid();
  if (event.key.toLowerCase() === 'r') reset();
  if (event.key.toLowerCase() === 'p') startPour();
});

// Hidden test API for Astra/verifiers. It changes no visual presentation.
window.__STILLLIGHT_ORIGINAL_TWO_GLASS__ = {
  reset,
  hint: showHint,
  invalid: forceInvalid,
  pour: startPour,
  choose,
  state: () => ({ board: clone(board), selected, busy }),
  constants: { POUR_MS, SELECT_MS, INVALID_MS, SETTLE_MS, HINT_ATTENTION_MS, TRANSFER_START, TRANSFER_END },
};

resize();
