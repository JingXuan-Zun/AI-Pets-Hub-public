import type { PetConfig } from '../types';

// The latest config of the main window, for guide steps triggered from places that have no
// config at hand (e.g. a task card finishing). Set by usePetRuntimeState.

let latest: PetConfig | null = null;

export function setSharedConfig(config: PetConfig) {
  latest = config;
}

export function readSharedConfig() {
  return latest;
}
