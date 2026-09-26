// Copied from the original STILLLIGHT gameplay implementation.
// Baseline formulas and constants remain unchanged; benchmark-only layout
// helpers reuse the same equations against a wider 10-glass viewport.
export const W = 400;
export const H = 620;
export const STRESS_W = 760;
export const STRESS_H = 620;
export const EDGE_MARGIN = 8;
export const GLASS_HALF_WIDTH = 33;
export const GLASS_HEIGHT = 156;
export const SELECT_LIFT = 10;

const GLASS_CORNERS = [
  [-GLASS_HALF_WIDTH, 0],
  [GLASS_HALF_WIDTH, 0],
  [GLASS_HALF_WIDTH, GLASS_HEIGHT],
  [-GLASS_HALF_WIDTH, GLASS_HEIGHT],
];

// Exact original positioning used by the 2-glass baseline.
export const position = (index) => ({
  x: 80 + (index % 3) * 120,
  y: 130 + Math.floor(index / 3) * 242,
});

// Benchmark-only 5 x 2 arrangement. Glass dimensions are unchanged.
export const stressPosition = (index) => ({
  x: 76 + (index % 5) * 152,
  y: 96 + Math.floor(index / 5) * 292,
});

export const clamp01 = (value) => Math.max(0, Math.min(1, value));
export const smooth = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };
export const smoother = (value) => { const t = clamp01(value); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOutCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3);

export function transformedGlassCorners(pose) {
  const cosine = Math.cos(pose.angle);
  const sine = Math.sin(pose.angle);
  return GLASS_CORNERS.map(([x, y]) => ({
    x: pose.x + x * cosine - y * sine,
    y: pose.y + x * sine + y * cosine,
  }));
}

export function glassBounds(pose) {
  const corners = transformedGlassCorners(pose);
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function clampPoseToViewport(pose, width, height) {
  const bounds = glassBounds(pose);
  let x = pose.x;
  let y = pose.y;
  if (bounds.minX < EDGE_MARGIN) x += EDGE_MARGIN - bounds.minX;
  if (bounds.maxX > width - EDGE_MARGIN) x -= bounds.maxX - (width - EDGE_MARGIN);
  if (bounds.minY < EDGE_MARGIN) y += EDGE_MARGIN - bounds.minY;
  if (bounds.maxY > height - EDGE_MARGIN) y -= bounds.maxY - (height - EDGE_MARGIN);
  return { x, y, angle: pose.angle };
}

export function clampPose(pose) {
  return clampPoseToViewport(pose, W, H);
}

export function stressClampPose(pose) {
  return clampPoseToViewport(pose, STRESS_W, STRESS_H);
}

function pourDirectionFor(source, target, positionFor, width) {
  const sourcePosition = positionFor(source);
  const targetPosition = positionFor(target);
  if (targetPosition.x < width / 2) return -1;
  if (targetPosition.x > width / 2) return 1;
  if (sourcePosition.x !== targetPosition.x) return sourcePosition.x < targetPosition.x ? 1 : -1;
  return source < target ? 1 : -1;
}

export function pourDirection(source, target) {
  return pourDirectionFor(source, target, position, W);
}

export function stressPourDirection(source, target) {
  return pourDirectionFor(source, target, stressPosition, STRESS_W);
}

export function tiltForUnits(remainingUnits) {
  return Math.max(0.78, Math.min(1.565, 1.59 - Math.max(0, remainingUnits) * 0.19));
}

function movingPoseFor(source, target, progress, remainingUnits, positionFor, directionFor, columns, clampFor) {
  const home = positionFor(source);
  const destination = positionFor(target);
  const direction = directionFor(source, target);
  const p = clamp01(progress);

  const approach = smoother(p / 0.28);
  const retreat = smoother((p - 0.70) / 0.30);
  const presence = approach * (1 - retreat);

  const tiltIn = smoother((p - 0.10) / 0.22);
  const tiltOut = smoother((p - 0.68) / 0.20);
  const angleFactor = tiltIn * (1 - tiltOut);
  const angle = direction * tiltForUnits(remainingUnits) * angleFactor;

  const lipOffsetX = direction * GLASS_HALF_WIDTH * Math.cos(angle);
  const pourCenterX = destination.x - lipOffsetX;
  const sameRow = Math.floor(source / columns) === Math.floor(target / columns);
  const pourCenterY = destination.y - (sameRow ? 82 : 135);

  const startY = home.y - SELECT_LIFT;
  const returnToSlot = SELECT_LIFT * smoother((p - 0.80) / 0.20);
  const travelArc = -9 * Math.sin(Math.PI * Math.min(1, approach)) * (1 - retreat);
  const returnSettle = p > 0.78 ? 2.2 * Math.sin((p - 0.78) / 0.22 * Math.PI) * (1 - p) / 0.22 : 0;

  const raw = {
    x: home.x + (pourCenterX - home.x) * presence,
    y: startY + returnToSlot + (pourCenterY - startY) * presence + travelArc + returnSettle,
    angle,
  };
  return clampFor(raw);
}

export function movingPose(source, target, progress, remainingUnits) {
  return movingPoseFor(source, target, progress, remainingUnits, position, pourDirection, 3, clampPose);
}

export function stressMovingPose(source, target, progress, remainingUnits) {
  return movingPoseFor(source, target, progress, remainingUnits, stressPosition, stressPourDirection, 5, stressClampPose);
}

function selectedPoseFor(index, progress, positionFor) {
  const home = positionFor(index);
  const t = clamp01(progress);
  const lift = SELECT_LIFT * easeOutCubic(t);
  const settle = t < 1 ? Math.sin(t * Math.PI * 3.2) * 1.8 * (1 - t) : 0;
  return { x: home.x, y: home.y - lift + settle, angle: 0 };
}

export function selectedPose(index, progress = 1) {
  return selectedPoseFor(index, progress, position);
}

export function stressSelectedPose(index, progress = 1) {
  return selectedPoseFor(index, progress, stressPosition);
}

function invalidPoseFor(index, progress, direction, positionFor, clampFor) {
  const home = positionFor(index);
  const p = clamp01(progress);
  const envelope = Math.pow(1 - p, 1.35);
  const oscillation = Math.sin(p * Math.PI * 5.4);
  const returnHome = smoother((p - 0.70) / 0.30);
  return clampFor({
    x: home.x + direction * 8.5 * oscillation * envelope,
    y: home.y - SELECT_LIFT * (1 - returnHome) + 1.2 * Math.sin(p * Math.PI * 2) * envelope,
    angle: direction * 0.075 * oscillation * envelope,
  });
}

export function invalidPose(index, progress, direction) {
  return invalidPoseFor(index, progress, direction, position, clampPose);
}

export function stressInvalidPose(index, progress, direction) {
  return invalidPoseFor(index, progress, direction, stressPosition, stressClampPose);
}

export function pouringLip(pose, direction) {
  const localX = direction * GLASS_HALF_WIDTH;
  return {
    x: pose.x + localX * Math.cos(pose.angle),
    y: pose.y + localX * Math.sin(pose.angle),
  };
}

export function streamControl(start, end, direction) {
  return {
    x: (start.x + end.x) / 2 + direction * 7,
    y: start.y + Math.max(16, (end.y - start.y) * 0.58),
  };
}
