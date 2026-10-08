/**
 * Obsidian-style force simulation, following d3-force semantics: a cooling
 * alpha, velocity decay, many-body repulsion, link springs, a gentle pull to the
 * center and collision. Dragging keeps the whole graph warm so every node
 * reacts, and the graph drifts to rest after release instead of stopping dead.
 */
export interface MemoryForceSettings {
  centerStrength: number;
  collideRadius: number;
  /** Share of the pointer's movement passed straight to directly linked memories. */
  followStrength: number;
  linkDistance: number;
  repelStrength: number;
}

export const DEFAULT_MEMORY_FORCE_SETTINGS: MemoryForceSettings = {
  centerStrength: 0.06,
  collideRadius: 12,
  followStrength: 0.55,
  linkDistance: 60,
  repelStrength: 140,
};

export interface MemoryForceNode {
  fx?: number;
  fy?: number;
  id: string;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

const ALPHA_MIN = 0.001;
// d3 default: reaches ALPHA_MIN in ~300 ticks.
const ALPHA_DECAY = 1 - ALPHA_MIN ** (1 / 300);
const VELOCITY_DECAY = 0.3;
const DRAG_ALPHA_TARGET = 0.5;
const LINK_STRENGTH = 1;
// 2-hop neighbours follow the pointer by this fraction of the 1-hop share, so a
// dragged memory visibly pulls its surroundings instead of only stretching links.
const SECOND_HOP_FOLLOW = 0.36;
// While a node is held, centering nearly stops so linked memories hang off it
// instead of being pulled back toward the middle into stretched lines.
const DRAG_CENTER_FACTOR = 0.1;
// After release the graph cools from this low heat, so stretched links ease back
// over about a second instead of snapping.
const RELEASE_ALPHA = 0.05;
// A settings change reheats enough that the new layout visibly settles in.
const SETTINGS_REHEAT = 0.7;

export function createMemoryForceSimulation(
  ids: string[],
  links: Array<{ source: string; target: string }>,
  settings: MemoryForceSettings,
  previous?: Map<string, { x: number; y: number }>,
) {
  let config = settings;
  let alpha = 1;
  let alphaTarget = 0;
  const nodes: MemoryForceNode[] = ids.map((id, index) => {
    const kept = previous?.get(id);
    // d3's phyllotaxis start; known nodes keep their place across data updates.
    const radius = 10 * Math.sqrt(0.5 + index); const angle = index * Math.PI * (3 - Math.sqrt(5));
    return { id, vx: 0, vy: 0, x: kept?.x ?? radius * Math.cos(angle), y: kept?.y ?? radius * Math.sin(angle) };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  links.forEach((link) => {
    if (!byId.has(link.source) || !byId.has(link.target) || link.source === link.target) return;
    adjacency.set(link.source, [...(adjacency.get(link.source) ?? []), link.target]);
    adjacency.set(link.target, [...(adjacency.get(link.target) ?? []), link.source]);
  });
  let followers: Array<{ node: MemoryForceNode; share: number }> = [];
  const collectFollowers = (id: string) => {
    const seen = new Set([id]);
    let frontier = [id];
    followers = [];
    [config.followStrength, config.followStrength * SECOND_HOP_FOLLOW].forEach((share) => {
      const next: string[] = [];
      frontier.forEach((current) => (adjacency.get(current) ?? []).forEach((neighbor) => {
        if (seen.has(neighbor)) return;
        seen.add(neighbor); next.push(neighbor);
        followers.push({ node: byId.get(neighbor)!, share });
      }));
      frontier = next;
    });
  };
  const degree = new Map<string, number>();
  const springs = links.flatMap((link) => {
    const source = byId.get(link.source); const target = byId.get(link.target);
    if (!source || !target || source === target) return [];
    degree.set(source.id, (degree.get(source.id) ?? 0) + 1);
    degree.set(target.id, (degree.get(target.id) ?? 0) + 1);
    return [{ source, target }];
  });
  if (previous && nodes.every((node) => previous.has(node.id))) alpha = 0.3;

  const applyLinks = () => springs.forEach(({ source, target }) => {
    let dx = target.x + target.vx - source.x - source.vx;
    let dy = target.y + target.vy - source.y - source.vy;
    const distance = Math.hypot(dx, dy) || 1e-6;
    const strength = LINK_STRENGTH;
    const force = ((distance - config.linkDistance) / distance) * alpha * strength;
    dx *= force; dy *= force;
    const sourceShare = (degree.get(source.id) ?? 1) / ((degree.get(source.id) ?? 1) + (degree.get(target.id) ?? 1));
    target.vx -= dx * sourceShare; target.vy -= dy * sourceShare;
    source.vx += dx * (1 - sourceShare); source.vy += dy * (1 - sourceShare);
  });
  const applyRepulsion = () => {
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const dx = nodes[b].x - nodes[a].x || 1e-3; const dy = nodes[b].y - nodes[a].y || 1e-3;
        const distanceSquared = Math.max(1, dx * dx + dy * dy);
        const force = (config.repelStrength * alpha) / distanceSquared;
        nodes[a].vx -= dx * force; nodes[a].vy -= dy * force;
        nodes[b].vx += dx * force; nodes[b].vy += dy * force;
      }
    }
  };
  const applyCenterAndCollide = () => {
    // Pull toward the graph's own centroid, so it stays wherever it was dragged to.
    const center = config.centerStrength * alpha * (alphaTarget > 0 ? DRAG_CENTER_FACTOR : 1);
    const meanX = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length;
    const meanY = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;
    nodes.forEach((node) => {
      node.vx -= (node.x - meanX) * center;
      node.vy -= (node.y - meanY) * center;
    });
    const minimum = config.collideRadius * 2;
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const dx = nodes[b].x + nodes[b].vx - nodes[a].x - nodes[a].vx;
        const dy = nodes[b].y + nodes[b].vy - nodes[a].y - nodes[a].vy;
        const distance = Math.hypot(dx, dy);
        if (distance >= minimum || distance === 0) continue;
        const push = ((minimum - distance) / distance) * 0.5;
        nodes[a].vx -= dx * push; nodes[a].vy -= dy * push;
        nodes[b].vx += dx * push; nodes[b].vy += dy * push;
      }
    }
  };

  return {
    /** True while the graph is still moving (or being dragged). */
    isActive: () => alpha >= ALPHA_MIN || alphaTarget > 0,
    nodes,
    tick() {
      alpha += (alphaTarget - alpha) * ALPHA_DECAY;
      applyLinks(); applyRepulsion(); applyCenterAndCollide();
      nodes.forEach((node) => {
        if (node.fx !== undefined && node.fy !== undefined) {
          node.x = node.fx; node.y = node.fy; node.vx = 0; node.vy = 0; return;
        }
        node.vx *= 1 - VELOCITY_DECAY; node.vy *= 1 - VELOCITY_DECAY;
        node.x += node.vx; node.y += node.vy;
      });
    },
    dragStart(id: string) {
      const node = byId.get(id); if (!node) return;
      alphaTarget = DRAG_ALPHA_TARGET; alpha = Math.max(alpha, DRAG_ALPHA_TARGET);
      node.fx = node.x; node.fy = node.y;
      collectFollowers(id);
    },
    dragMove(id: string, point: { x: number; y: number }) {
      const node = byId.get(id); if (!node) return;
      const dx = point.x - (node.fx ?? node.x); const dy = point.y - (node.fy ?? node.y);
      followers.forEach(({ node: follower, share }) => { follower.x += dx * share; follower.y += dy * share; });
      node.fx = point.x; node.fy = point.y;
    },
    dragEnd(id: string) {
      const node = byId.get(id); if (!node) return;
      alphaTarget = 0; alpha = Math.min(alpha, RELEASE_ALPHA); node.fx = undefined; node.fy = undefined; followers = [];
    },
    setSettings(next: MemoryForceSettings) {
      config = next; alpha = Math.max(alpha, SETTINGS_REHEAT);
    },
  };
}

export type MemoryForceSimulation = ReturnType<typeof createMemoryForceSimulation>;
