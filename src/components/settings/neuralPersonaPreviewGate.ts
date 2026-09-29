export function resolveNeuralPersonaSettingsPreviewEnabled(
  featureEnabled: boolean,
  buildPreviewValue: unknown,
) {
  return featureEnabled || buildPreviewValue === 'true';
}
