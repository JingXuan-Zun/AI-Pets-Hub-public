interface DragConstraintNode {
  nodeId: string;
  x: number;
  y: number;
}

interface DragConstraintLink {
  source: DragConstraintNode;
  target: DragConstraintNode;
}

function constrainPair(
  link: DragConstraintLink, rootNodeId: string, maximumDistance: number,
) {
  const dx = link.target.x - link.source.x;
  const dy = link.target.y - link.source.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maximumDistance || distance < 0.001) return;
  const excessX = (dx / distance) * (distance - maximumDistance);
  const excessY = (dy / distance) * (distance - maximumDistance);
  const sourceShare = link.source.nodeId === rootNodeId ? 0
    : link.target.nodeId === rootNodeId ? 1 : 0.5;
  const targetShare = link.target.nodeId === rootNodeId ? 0
    : link.source.nodeId === rootNodeId ? 1 : 0.5;
  link.source.x += excessX * sourceShare;
  link.source.y += excessY * sourceShare;
  link.target.x -= excessX * targetShare;
  link.target.y -= excessY * targetShare;
}

export function limitNeuralPersonaGraphDragStretch(
  links: DragConstraintLink[], rootNodeId: string, maximumDistance: number,
  initialMaximums?: ReadonlyMap<DragConstraintLink, number>,
) {
  if (maximumDistance <= 0) return;
  for (let pass = 0; pass < 4; pass += 1) {
    links.forEach((link) => constrainPair(
      link, rootNodeId, Math.max(maximumDistance, initialMaximums?.get(link) ?? 0),
    ));
  }
}
