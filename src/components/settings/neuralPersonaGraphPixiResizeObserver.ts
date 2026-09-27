import type { Application } from 'pixi.js';
import {
  neuralGraphHostSize,
  resizeNeuralGraphPixiApplication,
} from './neuralPersonaGraphPixiApplication';

export function installNeuralPersonaGraphResizeObserver(
  app: Application,
  host: HTMLDivElement,
  wake: () => void,
) {
  let renderedHeight = app.renderer.screen.height;
  let renderedWidth = app.renderer.screen.width;
  const resize = () => {
    const size = neuralGraphHostSize(host);
    if (size.width === renderedWidth && size.height === renderedHeight) return;
    renderedHeight = size.height;
    renderedWidth = size.width;
    resizeNeuralGraphPixiApplication(app, size);
    wake();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  return () => observer.disconnect();
}
