import { type FolderItem, type PetConfig } from '../../types';

type VideoItemInteraction = { modelUrl: string; folderPath: string };
type Listener = (interaction: VideoItemInteraction) => void;
const listeners = new Set<Listener>();

export function subscribeVideoItemInteractions(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Clips asked for by name ("跳个舞" → the 跳舞/ folder, 2026-11-18): always listened to, unlike
// item interactions, which follow the per-model switch.
const clipListeners = new Set<Listener>();

export function subscribeVideoClipRequests(listener: Listener) {
  clipListeners.add(listener);
  return () => { clipListeners.delete(listener); };
}

/** Plays one clip from that folder on every video pet showing this model; false when none listens. */
export function publishVideoClipRequest(request: VideoItemInteraction) {
  clipListeners.forEach((listener) => listener(request));
  return clipListeners.size > 0;
}

export function publishVideoItemInteraction(config: PetConfig, folder: FolderItem) {
  if (config.modelType !== '2d' || !folder.appearanceId) return false;
  const preset = config.customModelPresets.find((item) => (
    item.type === '2d' && item.url === config.modelUrl && item.renderKind === 'video'
  ));
  const folderPath = preset?.videoItemBindings?.find((item) => item.appearanceId === folder.appearanceId)?.folderPath;
  if (!folderPath) return false;
  listeners.forEach((listener) => listener({ modelUrl: config.modelUrl, folderPath }));
  return true;
}
