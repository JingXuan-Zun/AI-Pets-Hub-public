import * as THREE from 'three';
import { Application } from 'pixi.js';
import { resolve3DModelFormatFromUrl, resolve3DModelLoaderUrl } from '../../model3dFormatSupport';
import { loadAvatar3DRuntimeInstanceByFormat } from '../../pet-runtime/avatar3d/avatar3dAssetLoader';
import { resolveAvatar3DModelLayout } from '../../pet-runtime/avatar3d/avatar3dModelLayout';
import { resolveLive2DModelRuntimeUrl } from '../../pet-runtime/live2d/live2dModelSupport';
import { loadLive2DCubism4Runtime, resolveLive2DVisibleDrawableBounds, type Live2DModelLike } from '../pet/live2dModelRuntime';
import type { ModelType } from '../../types';

// Model library cards show a picture of every model. A live renderer per card would load every
// model at once (one WebGL context and the whole model each), so each model is drawn once,
// offscreen and one at a time, and the picture is kept.

const THUMBNAIL_SIZE = 384;
const CACHE_PREFIX = 'desktop-pet:model-thumbnail:v1:';
const IDLE_SETTLE_FRAMES = 45;

type ThumbnailModel = { type: ModelType; url: string };

const pendingThumbnails = new Map<string, Promise<string | null>>();
let renderQueue: Promise<unknown> = Promise.resolve();

function cacheKey(model: ThumbnailModel) {
  return `${CACHE_PREFIX}${model.type}:${model.url}`;
}

export function readCachedModelThumbnail(model: ThumbnailModel) {
  try {
    return window.localStorage.getItem(cacheKey(model));
  } catch {
    return null;
  }
}

function saveModelThumbnail(model: ThumbnailModel, dataUrl: string) {
  try {
    window.localStorage.setItem(cacheKey(model), dataUrl);
  } catch {
    // Storage full or unavailable: the picture is redrawn next time.
  }
}

export function requestModelThumbnail(model: ThumbnailModel): Promise<string | null> {
  const cached = readCachedModelThumbnail(model);
  if (cached) return Promise.resolve(cached);
  const key = cacheKey(model);
  const pending = pendingThumbnails.get(key);
  if (pending) return pending;
  const next = renderQueue
    .then(() => (model.type === 'live2d' ? renderLive2DThumbnail(model.url) : renderAvatar3DThumbnail(model.url)))
    .then((dataUrl) => {
      if (dataUrl) saveModelThumbnail(model, dataUrl);
      return dataUrl;
    })
    .catch((error) => {
      console.warn('model thumbnail failed', model.url, error);
      return null;
    })
    .finally(() => pendingThumbnails.delete(key));
  renderQueue = next;
  pendingThumbnails.set(key, next);
  return next;
}

// The same lights as the desktop pet scene, so a picture looks like the pet will.
function createPetLights() {
  const lights = new THREE.Group();
  lights.add(new THREE.AmbientLight(0xffffff, 0.82));
  lights.add(new THREE.HemisphereLight(0xdfe8f5, 0x393d46, 0.18));
  const key = new THREE.DirectionalLight(0xf8f1eb, 1.18);
  key.position.set(2.6, 4.8, 6.6);
  const hero = new THREE.DirectionalLight(0xf7f5ee, 0.78);
  hero.position.set(0.85, 2.2, 5.6);
  const fill = new THREE.DirectionalLight(0xc7d7ea, 0.28);
  fill.position.set(-4.6, 1.8, 3.2);
  const rim = new THREE.DirectionalLight(0xaab7cc, 0.26);
  rim.position.set(-4.8, 3.1, -4.6);
  lights.add(key, hero, fill, rim);
  return lights;
}

async function renderAvatar3DThumbnail(url: string) {
  const format = resolve3DModelFormatFromUrl(url);
  if (!format) return null;
  const instance = await loadAvatar3DRuntimeInstanceByFormat({ format, sourceUrl: resolve3DModelLoaderUrl(url) });
  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas, preserveDrawingBuffer: true });
  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(createPetLights());
    const layout = resolveAvatar3DModelLayout(instance.object);
    const scaled = new THREE.Group();
    scaled.scale.setScalar(layout.normalizedScale);
    const centred = new THREE.Group();
    centred.position.set(...layout.position);
    centred.add(instance.object);
    scaled.add(centred);
    scene.add(scaled);
    // Let the idle pose settle (MMD arms come down, VRM springs rest) before the picture.
    for (let frame = 0; frame < IDLE_SETTLE_FRAMES; frame += 1) {
      scene.updateMatrixWorld(true);
      instance.update?.(1 / 60, undefined);
    }
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 0, 3.9);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return canvas.toDataURL('image/webp', 0.9);
  } finally {
    instance.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

async function renderLive2DThumbnail(url: string) {
  const { Live2DModel } = await loadLive2DCubism4Runtime();
  const app = new Application({
    autoStart: false,
    backgroundAlpha: 0,
    height: THUMBNAIL_SIZE,
    preserveDrawingBuffer: true,
    width: THUMBNAIL_SIZE,
  });
  let model: Live2DModelLike | null = null;
  try {
    model = await Live2DModel.from(resolveLive2DModelRuntimeUrl(url), { autoInteract: false, autoUpdate: false }) as Live2DModelLike;
    app.stage.addChild(model as never);
    model.update(16);
    // Fit what is actually drawn: many Live2D canvases are mostly empty margin.
    const visible = resolveLive2DVisibleDrawableBounds(model);
    const bounds = visible ?? { height: model.height, width: model.width, x: 0, y: 0 };
    const scale = (THUMBNAIL_SIZE * 0.94) / Math.max(bounds.width, bounds.height, 1);
    model.scale.set(scale, scale);
    model.position.set(
      THUMBNAIL_SIZE / 2 - (bounds.x + bounds.width / 2) * scale,
      THUMBNAIL_SIZE / 2 - (bounds.y + bounds.height / 2) * scale,
    );
    app.renderer.render(app.stage);
    return (app.view as HTMLCanvasElement).toDataURL('image/webp', 0.9);
  } finally {
    model?.destroy();
    app.destroy(true, { children: true });
  }
}
