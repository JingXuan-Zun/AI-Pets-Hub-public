import { type FolderItem, type PetConfig } from '../../types';

type VideoItemInteraction = { modelUrl: string; folderPath: string };
type Listener = (interaction: VideoItemInteraction) => void;
const listeners = new Set<Listener>();

export function subscribeVideoItemInteractions(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
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
