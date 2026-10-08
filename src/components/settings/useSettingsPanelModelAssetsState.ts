import { DEFAULT_BUILTIN_WALKING_PET_MODEL_URL, PRESET_MODELS, getVisiblePetModelPresets } from '../../constants';
import { DEFAULT_FOOD_APPEARANCES, MAX_FOOD_APPEARANCES } from '../../foodAppearances';
import {
  resolve3DModelFormatFromFileName,
  shouldPersist3DModelAsLocalPath,
} from '../../model3dFormatSupport';
import {
  applyDesktopPetModelSelection,
  applyDesktopPetSlotChanges,
  getDesktopPetSlots,
} from '../../multiPetRoster';
import {
  type FoodAppearance,
  type ModelType,
  type PetConfig,
  type PetModelMotionAssetFormat,
  type PetModelMotionBinding,
  type PetModelMotionKey,
  type PetModelPreset,
} from '../../types';
import {
  guessPetModelMotionKeyFromFileName,
} from '../../pet-runtime/content/petModelMotionBindings';
import {
  discoverLive2DExpressionBindingsForModel,
} from '../../pet-runtime/live2d/live2dExpressionBindingDiscovery';
import {
  MAX_CUSTOM_2D_MODEL_EDGE,
  MAX_CUSTOM_3D_MODEL_FILE_SIZE_BYTES,
  MAX_CUSTOM_PET_MODELS,
  fileToCompactImageDataUrl,
  fileToCustom2DSequenceDataUrls,
  fileToCustom3DModelUrl,
  fileToCustomLive2DModelUrl,
  fileToCustomMotionSource,
  inspectCustomMotionMetadata,
  isCustom2DVideoFile,
  resolveElectronSelectedFilePath,
  resolveCustomMotionFormatFromFileName,
  resolveCustomPetModelType,
} from './settingsModelImportUtils';
import { canModelTypeUseMotionBindings } from '../../pet-runtime/live2d/live2dModelSupport';
import {
  normalizeLive2DRuntimeProfileConfig,
  type Live2DRuntimeProfileConfigV1,
} from '../../pet-runtime/live2d/live2dRuntimeProfile';

interface UseSettingsPanelModelAssetsStateOptions {
  applyConfig: (newConfig: PetConfig) => void;
  commitModelConfig: (
    buildLocalConfig: (baseConfig: PetConfig) => PetConfig,
    buildCommittedConfig?: (baseConfig: PetConfig) => PetConfig,
  ) => PetConfig;
  localConfig: PetConfig;
  selectedPetSlotId: string;
}

export function useSettingsPanelModelAssetsState({
  applyConfig,
  commitModelConfig,
  localConfig,
  selectedPetSlotId,
}: UseSettingsPanelModelAssetsStateOptions) {
  const isLive2DLibraryFormat = (format: PetModelMotionAssetFormat | null) => (
    format === 'motion3' || format === 'exp3'
  );

  const appendModelMotionBindings = async (modelId: string, files: File[]) => {
    const matchedPreset = localConfig.customModelPresets.find((preset) => preset.id === modelId) ?? null;
    if (!matchedPreset || !canModelTypeUseMotionBindings(matchedPreset.type)) {
      throw new Error('请先选中一个自定义 3D 或 Live2D 模型，再导入动作文件。');
    }

    const acceptedFiles = files
      .map((file) => ({
        file,
        format: resolveCustomMotionFormatFromFileName(file.name),
      }))
      .filter((item): item is { file: File; format: PetModelMotionAssetFormat } => (
        matchedPreset.type === 'live2d'
          ? isLive2DLibraryFormat(item.format)
          : item.format !== null && !isLive2DLibraryFormat(item.format)
      ));

    if (!acceptedFiles.length) {
      throw new Error(
        matchedPreset.type === 'live2d'
          ? '当前 Live2D 模型只支持导入 .motion3.json 动作文件或 .exp3.json 表情文件。'
          : '当前 3D 模型只支持导入 VRMA / FBX / GLB / GLTF 动作文件。',
      );
    }

    const nextMotionBindings = await Promise.all(acceptedFiles.map(async ({ file, format }, index) => {
      const motionSource = await fileToCustomMotionSource(file);
      const motionInspection = await inspectCustomMotionMetadata(file, format);
      const fallbackName = `动作 ${(matchedPreset.motionBindings?.length ?? 0) + index + 1}`;
      const nameWithoutExtension = file.name.replace(/(?:\.motion3|\.exp3)?\.json$/iu, '').replace(/\.[^.]+$/, '').trim();

      return {
        clipNames: motionInspection.clipNames,
        durationMs: motionInspection.durationMs ?? undefined,
        format: motionSource.format,
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `motion-binding-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`,
        kind: motionSource.format === 'exp3' ? 'expression' : 'motion',
        motionKey: guessPetModelMotionKeyFromFileName(file.name),
        name: nameWithoutExtension || fallbackName,
        sourceUrl: motionSource.sourceUrl,
      } satisfies PetModelMotionBinding;
    }));

    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      customModelPresets: baseConfig.customModelPresets.map((preset) => (
        preset.id === modelId
          ? {
              ...preset,
              motionBindings: [...(preset.motionBindings ?? []), ...nextMotionBindings],
            }
          : preset
      )),
    }));
  };

  const removeModelMotionBinding = (modelId: string, bindingId: string) => {
    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      customModelPresets: baseConfig.customModelPresets.map((preset) => (
        preset.id === modelId
          ? {
              ...preset,
              motionBindings: (preset.motionBindings ?? []).filter((binding) => binding.id !== bindingId),
            }
          : preset
      )),
    }));
  };

  const updateModelMotionBindingKey = (
    modelId: string,
    bindingId: string,
    motionKey: PetModelMotionKey,
  ) => {
    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      customModelPresets: baseConfig.customModelPresets.map((preset) => (
        preset.id === modelId
          ? {
              ...preset,
              motionBindings: (preset.motionBindings ?? []).map((binding) => (
                binding.id === bindingId
                  ? {
                      ...binding,
                      motionKey,
                    }
                  : binding
              )),
            }
          : preset
      )),
    }));
  };

  const updateModelMotionBindingSemantic = (
    modelId: string,
    bindingId: string,
    updates: Pick<PetModelMotionBinding, 'semanticAliases' | 'semanticDescription' | 'semanticTags'>,
  ) => {
    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      customModelPresets: baseConfig.customModelPresets.map((preset) => (
        preset.id === modelId
          ? {
              ...preset,
              motionBindings: (preset.motionBindings ?? []).map((binding) => (
                binding.id === bindingId
                  ? {
                      ...binding,
                      semanticAliases: updates.semanticAliases,
                      semanticDescription: updates.semanticDescription,
                      semanticTags: updates.semanticTags,
                    }
                  : binding
              )),
            }
          : preset
      )),
    }));
  };

  const updateModelMotionBindingDuration = (
    modelId: string,
    bindingId: string,
    durationMs: number | null,
  ) => {
    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      customModelPresets: baseConfig.customModelPresets.map((preset) => (
        preset.id === modelId
          ? {
              ...preset,
              motionBindings: (preset.motionBindings ?? []).map((binding) => (
                binding.id === bindingId
                  ? {
                      ...binding,
                      durationMs: durationMs ?? undefined,
                    }
                  : binding
              )),
            }
          : preset
      )),
    }));
  };

  const updateLive2DRuntimeProfile = (
    modelId: string,
    profile: Live2DRuntimeProfileConfigV1 | null,
  ) => {
    const normalizedProfile = normalizeLive2DRuntimeProfileConfig(profile) ?? undefined;
    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      customModelPresets: baseConfig.customModelPresets.map((preset) => (
        preset.id === modelId && preset.type === 'live2d'
          ? {
              ...preset,
              live2dRuntimeProfile: normalizedProfile,
            }
          : preset
      )),
    }));
  };

  const appendCustomModelPresets = async (files: File[], customSequenceName?: string) => {
    const remainingSlots = Math.max(0, MAX_CUSTOM_PET_MODELS - localConfig.customModelPresets.length);
    const acceptedFiles = files
      .map((file) => ({
        file,
        type: resolveCustomPetModelType(file),
      }))
      .filter((item): item is { file: File; type: ModelType } => item.type !== null)
      .slice(0, remainingSlots);

    if (!acceptedFiles.length) {
      return;
    }

    // A multi-selection of 2D images is one animation, not several unrelated
    // models. Keep the first frame as the model entry point and persist every
    // selected frame beside it so the renderer can play the sequence later.
    const selected2DFrames = acceptedFiles
      .filter((item) => item.type === '2d' && !isCustom2DVideoFile(item.file))
      .map((item) => item.file)
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
    const modelImportEntries: Array<{ file: File; type: ModelType; sequenceFiles?: File[] }> = [
      ...acceptedFiles.filter((item) => item.type !== '2d'),
      ...acceptedFiles
        .filter((item) => item.type === '2d' && isCustom2DVideoFile(item.file))
        .map((item) => ({ file: item.file, type: '2d' as const })),
      ...(selected2DFrames[0]
        ? [{ file: selected2DFrames[0], type: '2d' as const, sequenceFiles: selected2DFrames }]
        : []),
    ].slice(0, remainingSlots);
    const nextCustomModelPresets = await Promise.all(modelImportEntries.map(async ({ file, type, sequenceFiles }, index) => {
      const isVideo = type === '2d' && isCustom2DVideoFile(file);
      const modelFormat = type === '3d'
        ? resolve3DModelFormatFromFileName(file.name)
        : null;

      if (
        type === '3d'
        && modelFormat
        && !shouldPersist3DModelAsLocalPath(modelFormat)
        && file.size > MAX_CUSTOM_3D_MODEL_FILE_SIZE_BYTES
      ) {
        throw new Error(`3D 模型文件过大：${file.name}。非 PMX 模型请尽量控制在 2MB 内。`);
      }

      if (isVideo) {
        const sourcePath = resolveElectronSelectedFilePath(file);
        const stagedVideo = sourcePath
          ? await window.desktopPetShell?.stage2DVideo?.({
              sourcePath,
              videoName: file.name.replace(/\.(?:webm|mp4|m4v|mov|gif)$/iu, '').trim(),
            })
          : null;
        if (stagedVideo && !stagedVideo.ok) {
          throw new Error(stagedVideo.error || 'WebM 视频备份失败，未导入模型。');
        }
        if (!stagedVideo?.videoUrl) {
          throw new Error('透明 WebM 桌宠需要在桌面版导入，才能备份并在下次启动后继续播放。');
        }
        const url = stagedVideo.videoUrl;
        // Clips imported from <root>/<group>/clip.webm make <root> the character
        // library: idle rotates through its subfolders and emotions pick by name.
        const videoLibrary = sourcePath
          ? await window.desktopPetShell?.resolve2DVideoLibraryRoot?.({ sourcePath }).catch(() => null)
          : null;
        const videoLibraryRootPath = videoLibrary?.ok ? videoLibrary.rootPath : undefined;
        const fallbackName = `自定义视频桌宠 ${localConfig.customModelPresets.length + index + 1}`;
        const nameWithoutExtension = file.name.replace(/\.(?:webm|mp4|m4v|mov|gif)$/iu, '').trim();
        return {
          id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `custom-video-model-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`,
          name: nameWithoutExtension || fallbackName,
          type,
          url,
          // stage2DVideo stores every imported format as WebM, including GIF;
          // the renderer must follow the staged output format.
          renderKind: 'video' as const,
          randomVideoPlaybackEnabled: Boolean(videoLibraryRootPath),
          videoLibraryRootPath,
          builtIn: false,
          motionBindings: [],
        } satisfies PetModelPreset;
      }

      const selectedSequenceFiles = sequenceFiles ?? [file];
      const inferredSequenceName = file.name
        .replace(/(?:[-_ ]?\d+)?\.[^.]+$/u, '')
        .trim() || '未命名序列帧动画';
      const sequenceName = customSequenceName?.trim() || inferredSequenceName;
      const sourcePaths = type === '2d'
        ? selectedSequenceFiles
          .map(resolveElectronSelectedFilePath)
          .filter((sourcePath): sourcePath is string => Boolean(sourcePath))
        : [];
      const stagedSequence = type === '2d' && sourcePaths.length > 0
        ? await window.desktopPetShell?.stage2DSequence?.({ sequenceName, sourcePaths })
        : null;
      if (type === '2d' && stagedSequence && !stagedSequence.ok) {
        throw new Error(stagedSequence.error || '序列帧备份失败，未导入模型。');
      }
      const compactSequenceFrames = type === '2d'
        ? stagedSequence?.ok && stagedSequence.frameUrls?.length
          ? stagedSequence.frameUrls
          : sequenceFiles && sequenceFiles.length > 1
            ? await Promise.all(sequenceFiles.map((frameFile) => (
                fileToCompactImageDataUrl(frameFile, MAX_CUSTOM_2D_MODEL_EDGE)
              )))
            : await fileToCustom2DSequenceDataUrls(file, MAX_CUSTOM_2D_MODEL_EDGE)
        : [];
      const url = type === '2d'
        ? (compactSequenceFrames[0] ?? await fileToCompactImageDataUrl(file, MAX_CUSTOM_2D_MODEL_EDGE))
        : type === 'live2d'
            ? await fileToCustomLive2DModelUrl(file)
            : await fileToCustom3DModelUrl(file);
      const fallbackName = `自定义模型 ${localConfig.customModelPresets.length + index + 1}`;
      const nameWithoutExtension = file.name.replace(/\.[^.]+$/, '').trim();

      const presetId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `custom-model-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`;
      const motionBindings = type === 'live2d'
        ? await discoverLive2DExpressionBindingsForModel({
            idPrefix: presetId,
            modelUrl: url,
          })
        : [];

      return {
        id: presetId,
        name: nameWithoutExtension || fallbackName,
        type,
        url,
        ...(compactSequenceFrames.length > 0 ? { sequenceFrames: compactSequenceFrames } : {}),
        ...(stagedSequence?.folderId ? { sequenceAssetFolder: stagedSequence.folderId } : {}),
        builtIn: false,
        motionBindings,
      } satisfies PetModelPreset;
    }));

    const firstImportedPreset = nextCustomModelPresets[0] ?? null;
    commitModelConfig((baseConfig) => {
      const configWithPresetLibrary = {
        ...baseConfig,
        customModelPresets: [...baseConfig.customModelPresets, ...nextCustomModelPresets],
      };

      if (!firstImportedPreset) {
        return configWithPresetLibrary;
      }

      return applyDesktopPetModelSelection(configWithPresetLibrary, selectedPetSlotId, {
        modelType: firstImportedPreset.type,
        modelUrl: firstImportedPreset.url,
      });
    });
  };

  const removeModelPreset = (modelId: string) => {
    const builtInPreset = PRESET_MODELS.find((preset) => preset.id === modelId) ?? null;
    const removedPreset = builtInPreset
      ?? localConfig.customModelPresets.find((preset) => preset.id === modelId)
      ?? null;

    if (!removedPreset) {
      return;
    }

    // Build from the provided baseConfig so the committed snapshot (not the
    // unsaved draft) is what gets persisted. Previously this captured
    // `localConfig` in the closure and persisted the whole draft.
    commitModelConfig((baseConfig) => {
      const nextCustomModelPresets = builtInPreset
        ? baseConfig.customModelPresets
        : baseConfig.customModelPresets.filter((preset) => preset.id !== modelId);
      const nextHiddenBuiltinModelPresetIds = builtInPreset
        ? Array.from(new Set([...baseConfig.settings.hiddenBuiltinModelPresetIds, modelId]))
        : baseConfig.settings.hiddenBuiltinModelPresetIds;
      const nextVisibleModelPresets = getVisiblePetModelPresets(
        nextCustomModelPresets,
        nextHiddenBuiltinModelPresetIds,
      );
      const fallbackPreset = nextVisibleModelPresets[0] ?? null;
      let nextConfig = {
        ...baseConfig,
        customModelPresets: nextCustomModelPresets,
        settings: {
          ...baseConfig.settings,
          hiddenBuiltinModelPresetIds: nextHiddenBuiltinModelPresetIds,
        },
      };
      getDesktopPetSlots(nextConfig).forEach((slot) => {
        if (slot.modelType !== removedPreset.type || slot.modelUrl !== removedPreset.url) {
          return;
        }

        nextConfig = applyDesktopPetSlotChanges(nextConfig, slot.id, {
          modelType: fallbackPreset?.type ?? '2d',
          modelUrl: fallbackPreset?.url ?? DEFAULT_BUILTIN_WALKING_PET_MODEL_URL,
        });
      });

      return nextConfig;
    });
  };

  const restoreBuiltinModelPresets = () => {
    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      settings: {
        ...baseConfig.settings,
        hiddenBuiltinModelPresetIds: [],
      },
    }));
  };

  const appendFoodAppearances = async (files: File[]) => {
    const remainingSlots = Math.max(0, MAX_FOOD_APPEARANCES - localConfig.foodAppearances.length);
    const acceptedFiles = files
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, remainingSlots);

    if (!acceptedFiles.length) {
      return;
    }

    const nextFoodAppearances = await Promise.all(acceptedFiles.map(async (file, index) => {
      const imageUrl = await fileToCompactImageDataUrl(file);
      const fallbackName = `自定义食物 ${localConfig.foodAppearances.length + index + 1}`;
      const nameWithoutExtension = file.name.replace(/\.[^.]+$/, '').trim();

      return {
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `food-appearance-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`,
        name: nameWithoutExtension || fallbackName,
        imageUrl,
        builtIn: false,
      } satisfies FoodAppearance;
    }));

    applyConfig({
      ...localConfig,
      foodAppearances: [...localConfig.foodAppearances, ...nextFoodAppearances],
    });
  };

  const removeFoodAppearance = (appearanceId: string) => {
    applyConfig({
      ...localConfig,
      foodAppearances: localConfig.foodAppearances.filter((appearance) => appearance.id !== appearanceId),
    });
  };

  const updateFoodInteractionType = (appearanceId: string, interactionType: 'eat' | 'toy' | 'custom') => {
    applyConfig({
      ...localConfig,
      foodAppearances: localConfig.foodAppearances.map((appearance) => (
        appearance.id === appearanceId ? { ...appearance, interactionType,
          interactionLabel: interactionType === 'custom'
            ? (appearance.interactionLabel || appearance.name) : appearance.interactionLabel } : appearance
      )),
    });
  };

  const restoreFoodAppearances = () => {
    applyConfig({
      ...localConfig,
      foodAppearances: DEFAULT_FOOD_APPEARANCES.map((appearance) => ({ ...appearance })),
    });
  };

  return {
    appendCustomModelPresets,
    appendFoodAppearances,
    appendModelMotionBindings,
    removeFoodAppearance,
    updateFoodInteractionType,
    removeModelMotionBinding,
    removeModelPreset,
    restoreBuiltinModelPresets,
    restoreFoodAppearances,
    updateModelMotionBindingDuration,
    updateModelMotionBindingKey,
    updateModelMotionBindingSemantic,
    updateLive2DRuntimeProfile,
  };
}
