import { Graphics } from 'pixi.js';

type Point = { x: number; y: number };

export function createNeuralPersonaGraphPixiMarquee() {
  const graphic = new Graphics();
  graphic.visible = false;
  const set = (start?: Point, end?: Point) => {
    graphic.clear();
    if (!start || !end) { graphic.visible = false; return; }
    const x = Math.min(start.x, end.x); const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x); const height = Math.abs(end.y - start.y);
    graphic.lineStyle(1.5, 0x67e8f9, 0.95);
    graphic.beginFill(0x22d3ee, 0.12);
    graphic.drawRect(x, y, width, height);
    graphic.endFill();
    graphic.visible = true;
  };
  return { graphic, set };
}
