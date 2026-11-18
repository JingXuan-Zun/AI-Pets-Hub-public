

export function normalizeVisualSnapshotSourceTypeInput(value: string) {
  return value === 'screen' || value === 'window' ? value : 'all';
}
