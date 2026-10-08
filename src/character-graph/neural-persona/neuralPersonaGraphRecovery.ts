interface RecoveryPoint {
  velocityX?: number;
  velocityY?: number;
  x: number;
  y: number;
}

interface RecoveryLink {
  desiredDistance?: number;
  source: RecoveryPoint;
  target: RecoveryPoint;
}

function linkDistance(link: RecoveryLink) {
  return Math.hypot(
    link.target.x - link.source.x,
    link.target.y - link.source.y,
  );
}

function targetDistance(link: RecoveryLink, fallback: number) {
  return Math.max(1, link.desiredDistance ?? fallback);
}

const RECOVERY_LENGTH_RATIO = 1.02;
const RECOVERY_PASSES = 8;
const RECOVERY_RAMP_FRAMES = 4;

export function hasNeuralPersonaGraphExtremeStretch(
  links: RecoveryLink[], fallbackDistance: number,
) {
  return links.some((link) => (
    linkDistance(link) > targetDistance(link, fallbackDistance) * 3
  ));
}

function recoverLink(
  link: RecoveryLink, fallbackDistance: number,
  maximumStep: number, timeScale: number,
) {
  const dx = link.target.x - link.source.x;
  const dy = link.target.y - link.source.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const target = targetDistance(link, fallbackDistance);
  if (distance <= target * RECOVERY_LENGTH_RATIO) return;
  const ratio = 1 - Math.exp(-Math.max(0, timeScale) / 12);
  const correction = Math.min(distance - target, maximumStep * timeScale,
    (distance - target) * ratio);
  const correctionX = (dx / distance) * correction * 0.5;
  const correctionY = (dy / distance) * correction * 0.5;
  link.source.x += correctionX; link.source.y += correctionY;
  link.target.x -= correctionX; link.target.y -= correctionY;
}

function dampRecoveredNodes(links: RecoveryLink[]) {
  const nodes = new Set(links.flatMap((link) => [link.source, link.target]));
  nodes.forEach((node) => {
    if (node.velocityX !== undefined) node.velocityX *= 0.35;
    if (node.velocityY !== undefined) node.velocityY *= 0.35;
  });
}

export function recoverNeuralPersonaGraphExtremeStretch(
  links: RecoveryLink[], fallbackDistance: number,
  maximumStep: number, timeScale: number, framesSinceRelease = Number.POSITIVE_INFINITY,
) {
  // Ease in after release: the first frame runs a single pass, so the dragged
  // node starts rebounding instead of snapping back within one frame.
  const ramp = Math.min(1, Math.max(1 / RECOVERY_PASSES, (framesSinceRelease - 1) / RECOVERY_RAMP_FRAMES));
  for (let pass = 0; pass < RECOVERY_PASSES * ramp; pass += 1) {
    links.forEach((link) => {
      recoverLink(link, fallbackDistance, maximumStep, timeScale);
    });
  }
  const unfinished = links.some((link) => (
    linkDistance(link) > targetDistance(link, fallbackDistance) * RECOVERY_LENGTH_RATIO
  ));
  if (!unfinished) dampRecoveredNodes(links);
  return unfinished;
}
