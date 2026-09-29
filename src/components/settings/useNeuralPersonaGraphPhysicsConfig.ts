import { useEffect, useState } from 'react';
import {
  normalizeNeuralPersonaGraphPhysicsConfig,
  type NeuralPersonaGraphPhysicsConfig,
} from '../../character-graph/neural-persona';

function storageKey(roleId: string) {
  return `ai-desktop-pet:neural-graph-physics:v1:${encodeURIComponent(roleId)}`;
}

function readConfig(roleId: string) {
  if (typeof localStorage === 'undefined') return normalizeNeuralPersonaGraphPhysicsConfig();
  try {
    const stored = localStorage.getItem(storageKey(roleId));
    return normalizeNeuralPersonaGraphPhysicsConfig(stored ? JSON.parse(stored) : undefined);
  } catch {
    return normalizeNeuralPersonaGraphPhysicsConfig();
  }
}

export function useNeuralPersonaGraphPhysicsConfig(roleId: string) {
  const [config, setConfig] = useState(() => readConfig(roleId));
  useEffect(() => setConfig(readConfig(roleId)), [roleId]);
  const saveConfig = (input: NeuralPersonaGraphPhysicsConfig) => {
    const next = normalizeNeuralPersonaGraphPhysicsConfig(input);
    setConfig(next);
    try { localStorage.setItem(storageKey(roleId), JSON.stringify(next)); } catch { /* optional */ }
  };
  return { config, saveConfig };
}
