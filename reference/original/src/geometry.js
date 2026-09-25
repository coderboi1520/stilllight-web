// Extracted from the original STILLLIGHT gameplay implementation.
// The formulas and constants are intentionally unchanged.
export const W = 400;
export const H = 620;
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

// Preserve the original first-row glass positions. This harness draws only 0 and 1.
export const position = (index) => ({
  x: 80 + (index % 3) * 120,
  y: 130 + Math.floor(index / 3) * 242,
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

export function clampPose(pose) {
  const bounds = glassBounds(pose);
  let x = pose.x;
  let y = pose.y;
  if (bounds.minX < EDGE_MARGIN) x += EDGE_MARGIN - bounds.minX;
  if (bounds.maxX > W - EDGE_MARGIN) x -= bounds.maxX - (W - EDGE_MARGIN);
  if (bounds.minY < EDGE_MARGIN) y += EDGE_MARGIN - bounds.minY;
  if (bounds.maxY > H - EDGE_MARGIN) y -= bounds.maxY - (H - EDGE_MARGIN);
  return { x, y, angle: pose.angle };
}

export function pourDirection(source, target) {
  const sourcePosition = position(source);
  const targetPosition = position(target);
  if (targetPosition.x < W / 2) return -1;
  if (targetPosition.x > W / 2) return 1;
  if (sourcePosition.x !== targetPosition.x) return sourcePosition.x < targetPosition.x ? 1 : -1;
  return source < target ? 1 : -1;
}

export function tiltForUnits(remainingUnits) {
  return Math.max(0.78, Math.min(1.565, 1.59 - Math.max(0, remainingUnits) * 0.19));
}

export function movingPose(source, target, progress, remainingUnits) {
  const home = position(source);
  const destination = position(target);
  const direction = pourDirection(source, target);
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
  const sameRow = Math.floor(source / 3) === Math.floor(target / 3);
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
  return clampPose(raw);
}

export function selectedPose(index, progress = 1) {
  const home = position(index);
  const t = clamp01(progress);
  const lift = SELECT_LIFT * easeOutCubic(t);
  const settle = t < 1 ? Math.sin(t * Math.PI * 3.2) * 1.8 * (1 - t) : 0;
  return { x: home.x, y: home.y - lift + settle, angle: 0 };
}

export function invalidPose(index, progress, direction) {
  const home = position(index);
  const p = clamp01(progress);
  const envelope = Math.pow(1 - p, 1.35);
  const oscillation = Math.sin(p * Math.PI * 5.4);
  const returnHome = smoother((p - 0.70) / 0.30);
  return clampPose({
    x: home.x + direction * 8.5 * oscillation * envelope,
    y: home.y - SELECT_LIFT * (1 - returnHome) + 1.2 * Math.sin(p * Math.PI * 2) * envelope,
    angle: direction * 0.075 * oscillation * envelope,
  });
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
