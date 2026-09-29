import { Application, Container, UPDATE_PRIORITY } from 'pixi.js';
import { pushFrontendRuntimeError } from '../../frontendRuntimeLogger';

export type Live2DSharedFrameRegistration = {
  layer: Container;
  petId: string;
};

export function installLive2DSharedRendererFrameBoundary(
  app: Application,
  registrations: Set<Live2DSharedFrameRegistration>,
) {
  let lastErrorAt = Number.NEGATIVE_INFINITY;
  let lastErrorPetId = '';
  const reportError = (error: unknown, petId: string) => {
    const now = window.performance?.now?.() ?? Date.now();
    if (petId === lastErrorPetId && now - lastErrorAt < 1000) return;
    lastErrorAt = now;
    lastErrorPetId = petId;
    pushFrontendRuntimeError(
      'model',
      `live2d shared renderer frame failed pet=${petId}`,
      error,
      { registrationCount: registrations.size },
    );
  };

  const nativeRender = app.render.bind(app);
  app.ticker.remove(app.render, app);
  const safeRender = () => {
    try {
      nativeRender();
      return;
    } catch (error) {
      reportError(error, 'shared-stage');
      (app.renderer as unknown as { clear?: () => void }).clear?.();
    }

    let renderedCount = 0;
    registrations.forEach(({ layer, petId }) => {
      if (!layer.parent) return;
      try {
        app.renderer.render(layer, { clear: renderedCount === 0 });
        renderedCount += 1;
      } catch (error) {
        reportError(error, petId);
      }
    });
  };

  app.render = safeRender;
  app.ticker.add(safeRender, app, UPDATE_PRIORITY.LOW);
}
