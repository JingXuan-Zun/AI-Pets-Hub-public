function fallbackId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createNeuralPersonaEditorId(
  prefix: 'edge' | 'node',
  createId: () => string = fallbackId,
) {
  return `${prefix}:${createId()}`;
}
