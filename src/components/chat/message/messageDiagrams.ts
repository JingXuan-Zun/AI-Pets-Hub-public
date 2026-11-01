// Characters can draw a small diagram to explain something (“什么是剪影”): an ```svg code block in
// the reply. The chat window draws it in an isolated frame; speech, the desktop bubble and QQ
// leave the code out. A block still streaming in (no closing fence yet) is hidden the same way.

const CLOSED_BLOCK = /```svg[^\n]*\n([\s\S]*?)```/giu;
const OPEN_BLOCK = /```svg[^\n]*\n[\s\S]*$/iu;

/** Removes what an SVG must not carry even inside the sandbox: scripts, handlers, outside links. */
function cleanSvg(markup: string) {
  const trimmed = markup.trim();
  if (!/^<svg[\s>]/iu.test(trimmed) || !/<\/svg>\s*$/iu.test(trimmed)) return null;
  return trimmed
    .replace(/<script[\s\S]*?<\/script>/giu, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/giu, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/giu, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#|data:image\/)[^"]*"|'(?!#|data:image\/)[^']*')/giu, '');
}

export function splitMessageDiagrams(text: string): { diagrams: string[]; drawing: boolean; text: string } {
  const diagrams: string[] = [];
  let rest = text.replace(CLOSED_BLOCK, (_block, markup: string) => {
    const svg = cleanSvg(markup);
    if (svg) diagrams.push(svg);
    return '';
  });
  const drawing = OPEN_BLOCK.test(rest);
  if (drawing) rest = rest.replace(OPEN_BLOCK, '');
  return { diagrams, drawing, text: diagrams.length || drawing ? rest.replace(/\n{3,}/gu, '\n\n').trim() : rest };
}

/** The reply without its diagrams, for speech and places that cannot show a picture. */
export function stripMessageDiagrams(text: string, placeholder = '') {
  const { diagrams, text: rest } = splitMessageDiagrams(text);
  return diagrams.length && placeholder ? `${rest}${rest ? '\n' : ''}${placeholder}` : rest;
}

/** Width / height of the drawing, for sizing its frame. */
export function readDiagramAspect(svg: string) {
  const viewBox = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/iu.exec(svg);
  const width = Number(viewBox?.[1] ?? /\swidth\s*=\s*["']?([\d.]+)/iu.exec(svg)?.[1]);
  const height = Number(viewBox?.[2] ?? /\sheight\s*=\s*["']?([\d.]+)/iu.exec(svg)?.[1]);
  return width > 0 && height > 0 ? Math.min(4, Math.max(0.25, width / height)) : 4 / 3;
}

export function buildDiagramDocument(svg: string) {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    // Nothing may load or run: the frame shows the drawing and nothing else.
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:">',
    '<style>html,body{margin:0;height:100%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}svg{max-width:100%;max-height:100%;width:100%;height:100%}</style>',
    '</head><body>', svg, '</body></html>',
  ].join('');
}
