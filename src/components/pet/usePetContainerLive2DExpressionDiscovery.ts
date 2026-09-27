import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { discoverLive2DExpressionBindingsForModel } from '../../pet-runtime/live2d/live2dExpressionBindingDiscovery';
import {
  type PetConfig,
  type PetConfigUpdateHandler,
  type PetModelMotionBinding,
} from '../../types';

function createLive2DDiscoveryScanSignature(preset: PetConfig['customModelPresets'][number]) {
  const bindingSignature = (preset.motionBindings ?? [])
    .map((binding) => [
      binding.kind ?? '',
      binding.format,
      binding.motionKey,
      binding.name,
      binding.sourceUrl,
    ].join(':'))
    .sort()
    .join('|');

  return [
    preset.id,
    preset.type,
    preset.url,
    bindingSignature,
  ].join('::');
}

interface UsePetContainerLive2DExpressionDiscoveryOptions {
  configRef: MutableRefObject<PetConfig>;
  customModelPresets: PetConfig['customModelPresets'];
  onUpdateConfig: PetConfigUpdateHandler;
}

export function usePetContainerLive2DExpressionDiscovery({
  configRef,
  customModelPresets,
  onUpdateConfig,
}: UsePetContainerLive2DExpressionDiscoveryOptions) {
  const scanSignaturesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const discoveredBindingsByPresetId = new Map<string, PetModelMotionBinding[]>();
      for (const preset of configRef.current.customModelPresets) {
        if (preset.type !== 'live2d') {
          continue;
        }

        const scanSignature = createLive2DDiscoveryScanSignature(preset);
        if (scanSignaturesRef.current.has(scanSignature)) {
          continue;
        }
        scanSignaturesRef.current.add(scanSignature);

        const discoveredBindings = await discoverLive2DExpressionBindingsForModel({
          existingBindings: preset.motionBindings ?? [],
          idPrefix: preset.id,
          modelUrl: preset.url,
        });
        if (cancelled || discoveredBindings.length === 0) {
          continue;
        }

        discoveredBindingsByPresetId.set(preset.id, discoveredBindings);
      }

      if (cancelled || discoveredBindingsByPresetId.size === 0) {
        return;
      }

      onUpdateConfig({
        ...configRef.current,
        customModelPresets: configRef.current.customModelPresets.map((preset) => {
          const discoveredBindings = discoveredBindingsByPresetId.get(preset.id);
          if (!discoveredBindings?.length) {
            return preset;
          }

          return {
            ...preset,
            motionBindings: [
              ...(preset.motionBindings ?? []),
              ...discoveredBindings,
            ],
          };
        }),
      }, { priority: 'low' });
    })();

    return () => {
      cancelled = true;
    };
  }, [configRef, customModelPresets, onUpdateConfig]);
}
