// Drawn pieces of the report picture: line icons, the glowing network behind her, rings and
// bars. All inline SVG, so the page needs no files and no scripts.

const ICON_PATHS: Record<string, string> = {
  attention: 'M12 3l9 16H3L12 3z M12 10v4 M12 17h.01',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  check: 'M5 12l4 4L19 6',
  clock: 'M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  cross: 'M6 6l12 12 M18 6L6 18',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z M8.5 12l2.5 2.5 4.5-5',
  skip: 'M5 5l7 7-7 7 M13 5l7 7-7 7',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6',
};

export function icon(name: keyof typeof ICON_PATHS | string, color: string, size = 22) {
  const d = ICON_PATHS[name] ?? ICON_PATHS.spark;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;filter:drop-shadow(0 0 4px ${color})"><path d="${d}"/></svg>`;
}

export function pawMark(size: number, color = '#b9a8ff') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" style="filter:drop-shadow(0 0 8px ${color})"><g fill="${color}"><ellipse cx="32" cy="42" rx="14" ry="11"/><ellipse cx="16" cy="26" rx="6" ry="8"/><ellipse cx="27" cy="17" rx="6" ry="8"/><ellipse cx="38" cy="17" rx="6" ry="8"/><ellipse cx="49" cy="26" rx="6" ry="8"/></g></svg>`;
}

// A small deterministic random so the same report always draws the same network.
function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}

/** The glowing web of nodes behind her picture. */
export function networkSvg(width: number, height: number, seed: number) {
  const random = seeded(seed);
  const cx = width / 2;
  const cy = height / 2;
  const nodes = Array.from({ length: 46 }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const radius = (0.22 + random() * 0.78) * Math.min(cx, cy) * (index % 5 === 0 ? 1 : 0.92);
    return { r: 1.4 + random() * 2.6, x: cx + Math.cos(angle) * radius * 1.12, y: cy + Math.sin(angle) * radius * 0.92 };
  });
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    const nearest = nodes
      .map((other, otherIndex) => ({ distance: Math.hypot(other.x - node.x, other.y - node.y), otherIndex }))
      .filter((entry) => entry.otherIndex > index)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 2);
    for (const { otherIndex } of nearest) {
      const other = nodes[otherIndex];
      lines.push(`<line x1="${node.x.toFixed(1)}" y1="${node.y.toFixed(1)}" x2="${other.x.toFixed(1)}" y2="${other.y.toFixed(1)}"/>`);
    }
  });
  const dots = nodes.map((node, index) => {
    const color = index % 7 === 0 ? '#ff9bd2' : index % 5 === 0 ? '#ffd27a' : index % 3 === 0 ? '#9f8cff' : '#7fd8ff';
    return `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${node.r.toFixed(1)}" fill="${color}" filter="url(#glow)"/>`;
  });
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;inset:0">
<defs><filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#5b6cff" stop-opacity="0.45"/><stop offset="60%" stop-color="#3a3fb8" stop-opacity="0.16"/><stop offset="100%" stop-color="#1a1d5c" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="${cx}" cy="${cy}" rx="${(cx * 0.98).toFixed(0)}" ry="${(cy * 0.95).toFixed(0)}" fill="url(#halo)"/>
<g stroke="#8ea2ff" stroke-opacity="0.32" stroke-width="1">${lines.join('')}</g>${dots.join('')}</svg>`;
}

/** A segmented progress ring: done / attention / failed / skipped. */
export function statusRing(size: number, parts: Array<{ color: string; value: number }>, stroke = 10) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = parts.filter((part) => part.value > 0).map((part) => {
    const length = (part.value / total) * circumference;
    const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${part.color}" stroke-width="${stroke}" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" style="filter:drop-shadow(0 0 5px ${part.color})"/>`;
    offset += length;
    return arc;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="rgba(140,160,255,0.15)" stroke-width="${stroke}"/>${arcs.join('')}</svg>`;
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/gu, (character) => ({ '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[character] as string);
}
