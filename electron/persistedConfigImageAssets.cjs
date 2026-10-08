const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeErrorMessage, isPlainObject, writeBufferFileSafely } = require('./persistedConfigFiles.cjs');
const { normalizeSequenceAssetFolderName, buildLocalConfigAssetUrl, parseInlineImageDataUrl } = require('./persistedConfigImageRules.cjs');

function createImageExternalizer(assetDir) {
  const errors = [];
  let migratedCount = 0;
  let migratedBytes = 0;

  function externalizeValue(value, field, options = {}) {
    const parsedImage = parseInlineImageDataUrl(value, options);
    if (!parsedImage) {
      return value;
    }

    try {
      const digest = crypto.createHash('sha256').update(parsedImage.buffer).digest('hex');
      const targetDirectory = typeof options.targetDirectory === 'string' && options.targetDirectory
        ? options.targetDirectory
        : assetDir;
      const filePrefix = typeof options.filePrefix === 'string' && options.filePrefix
        ? `${options.filePrefix}-`
        : '';
      const assetPath = path.join(targetDirectory, `${filePrefix}${digest}.${parsedImage.extension}`);
      if (!fs.existsSync(assetPath)) {
        writeBufferFileSafely(assetPath, parsedImage.buffer);
      }
      migratedCount += 1;
      migratedBytes += Buffer.byteLength(value, 'utf8');
      return buildLocalConfigAssetUrl(assetPath);
    } catch (error) {
      errors.push({
        field,
        error: normalizeErrorMessage(error),
      });
      return value;
    }
  }

  return { externalizeValue, result: config => ({ config, migratedCount, migratedBytes, errors }) };
}

function externalizeProfileImages(config, nextConfig, externalizeValue) {
  if (isPlainObject(config.settings)) {
    nextConfig.settings = {
      ...config.settings,
      chatBackgroundImageUrl: externalizeValue(
        config.settings.chatBackgroundImageUrl,
        'settings.chatBackgroundImageUrl',
      ),
      chatUserAvatarUrl: externalizeValue(
        config.settings.chatUserAvatarUrl,
        'settings.chatUserAvatarUrl',
      ),
    };
  }

  if (isPlainObject(config.personality)) {
    nextConfig.personality = {
      ...config.personality,
      chatAvatarUrl: externalizeValue(
        config.personality.chatAvatarUrl,
        'personality.chatAvatarUrl',
      ),
    };
  }
}

function externalizeCompanionImages(config, nextConfig, externalizeValue) {
  if (Array.isArray(config.companionPets)) {
    nextConfig.companionPets = config.companionPets.map((pet, index) => {
      if (!isPlainObject(pet) || !isPlainObject(pet.personality)) {
        return pet;
      }

      return {
        ...pet,
        personality: {
          ...pet.personality,
          chatAvatarUrl: externalizeValue(
            pet.personality.chatAvatarUrl,
            `companionPets[${index}].personality.chatAvatarUrl`,
          ),
        },
      };
    });
  }
}

function externalizeSequencePreset(preset, presetIndex, sequenceAssetRootDir, externalizeValue) {
  if (!isPlainObject(preset) || preset.type !== '2d') {
    return preset;
  }

  const sequenceAssetFolder = normalizeSequenceAssetFolderName(
    preset.sequenceAssetFolder,
    `未命名序列帧动画-${presetIndex + 1}`,
  );
  const sequenceAssetDir = path.join(sequenceAssetRootDir, sequenceAssetFolder);
  const rawSequenceFrames = Array.isArray(preset.sequenceFrames)
    ? preset.sequenceFrames
    : [];
  const sequenceFrames = rawSequenceFrames.map((frameUrl, frameIndex) => (
    externalizeValue(
      frameUrl,
      `customModelPresets[${presetIndex}].sequenceFrames[${frameIndex}]`,
      {
        filePrefix: `frame-${String(frameIndex + 1).padStart(4, '0')}`,
        force: true,
        targetDirectory: sequenceAssetDir,
      },
    )
  ));
  const primaryFrame = sequenceFrames[0];

  return {
    ...preset,
    sequenceAssetFolder,
    sequenceFrames,
    url: primaryFrame || externalizeValue(
      preset.url,
      `customModelPresets[${presetIndex}].url`,
      {
        filePrefix: 'frame-0001',
        force: true,
        targetDirectory: sequenceAssetDir,
      },
    ),
  };
}

function externalizeSequenceImages(config, nextConfig, sequenceAssetRootDir, externalizeValue) {
  if (Array.isArray(config.customModelPresets)) {
    nextConfig.customModelPresets = config.customModelPresets.map((preset, index) => (
      externalizeSequencePreset(preset, index, sequenceAssetRootDir, externalizeValue)
    ));
  }
}

function externalizeConfigImageDataUrls(config, assetDir, sequenceAssetRootDir = assetDir) {
  if (!isPlainObject(config)) {
    return {
      config,
      migratedCount: 0,
      migratedBytes: 0,
      errors: [],
    };
  }

  const nextConfig = { ...config };
  const images = createImageExternalizer(assetDir);
  externalizeProfileImages(config, nextConfig, images.externalizeValue);
  externalizeCompanionImages(config, nextConfig, images.externalizeValue);
  externalizeSequenceImages(config, nextConfig, sequenceAssetRootDir, images.externalizeValue);
  return images.result(nextConfig);
}

module.exports = { externalizeConfigImageDataUrls };
