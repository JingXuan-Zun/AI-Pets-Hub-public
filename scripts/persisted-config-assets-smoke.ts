import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  BACKUP_FILE_NAME,
  CONFIG_ASSET_DIRECTORY_NAME,
  INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES,
  PRIMARY_FILE_NAME,
  createPersistedConfigStore,
} = require('../electron/persistedConfigStore.cjs') as {
  BACKUP_FILE_NAME: string;
  CONFIG_ASSET_DIRECTORY_NAME: string;
  INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES: number;
  PRIMARY_FILE_NAME: string;
  createPersistedConfigStore: (options: { userDataPath: string }) => {
    load: () => Record<string, unknown>;
    save: (config: unknown) => Record<string, unknown>;
  };
};
const { decodeLocalModelProtocolPath } = require('../electron/localModelProtocol.cjs') as {
  decodeLocalModelProtocolPath: (url: string) => string;
};

function makeImageDataUrl(byte: number, size = INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES) {
  return `data:image/png;base64,${Buffer.alloc(size, byte).toString('base64')}`;
}

function readPayload(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    config: Record<string, any>;
  };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-config-assets-'));

try {
  const legacyBackground = makeImageDataUrl(11, INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES * 2);
  const legacyUserAvatar = makeImageDataUrl(22);
  const legacyPersonalityAvatar = makeImageDataUrl(33);
  const legacyCompanionAvatar = makeImageDataUrl(44);
  const smallInlineImage = makeImageDataUrl(55, 32);
  const legacyConfig = {
    settings: {
      chatBackgroundImageUrl: legacyBackground,
      chatUserAvatarUrl: legacyUserAvatar,
    },
    personality: {
      chatAvatarUrl: legacyPersonalityAvatar,
    },
    companionPets: [
      {
        id: 'pet-1',
        personality: {
          chatAvatarUrl: legacyCompanionAvatar,
        },
      },
      {
        id: 'pet-2',
        personality: {
          chatAvatarUrl: smallInlineImage,
        },
      },
    ],
  };

  const primaryPath = path.join(tempRoot, PRIMARY_FILE_NAME);
  fs.writeFileSync(primaryPath, JSON.stringify({ version: 1, config: legacyConfig }), 'utf8');
  const legacyBytes = fs.statSync(primaryPath).size;

  const store = createPersistedConfigStore({ userDataPath: tempRoot });
  const loaded = store.load() as {
    ok: boolean;
    config: typeof legacyConfig;
    migratedAssetCount: number;
    migrationCompacted: boolean;
  };

  assert.equal(loaded.ok, true);
  assert.equal(loaded.migratedAssetCount, 4);
  assert.equal(loaded.migrationCompacted, true);
  assert.match(loaded.config.settings.chatBackgroundImageUrl, /^desktop-pet-file:\/\/local\//u);
  assert.match(loaded.config.settings.chatUserAvatarUrl, /^desktop-pet-file:\/\/local\//u);
  assert.match(loaded.config.personality.chatAvatarUrl, /^desktop-pet-file:\/\/local\//u);
  assert.match(loaded.config.companionPets[0].personality.chatAvatarUrl, /^desktop-pet-file:\/\/local\//u);
  assert.equal(loaded.config.companionPets[1].personality.chatAvatarUrl, smallInlineImage);

  const migratedUrls = [
    loaded.config.settings.chatBackgroundImageUrl,
    loaded.config.settings.chatUserAvatarUrl,
    loaded.config.personality.chatAvatarUrl,
    loaded.config.companionPets[0].personality.chatAvatarUrl,
  ];
  for (const migratedUrl of migratedUrls) {
    assert.equal(fs.existsSync(decodeLocalModelProtocolPath(migratedUrl)), true);
  }

  const compactedPayload = readPayload(primaryPath);
  const compactedText = fs.readFileSync(primaryPath, 'utf8');
  assert.ok(fs.statSync(primaryPath).size < legacyBytes / 4);
  assert.equal(compactedText.includes(legacyBackground), false);
  assert.match(compactedPayload.config.settings.chatBackgroundImageUrl, /^desktop-pet-file:\/\/local\//u);

  const backupText = fs.readFileSync(path.join(tempRoot, BACKUP_FILE_NAME), 'utf8');
  assert.match(backupText, /data:image\/png;base64,/u);

  const assetFiles = fs.readdirSync(path.join(tempRoot, CONFIG_ASSET_DIRECTORY_NAME));
  assert.equal(assetFiles.length, 4);
  for (const assetFile of assetFiles) {
    assert.ok(fs.statSync(path.join(tempRoot, CONFIG_ASSET_DIRECTORY_NAME, assetFile)).size > 0);
  }

  const secondLoad = store.load() as {
    ok: boolean;
    migratedAssetCount: number;
  };
  assert.equal(secondLoad.ok, true);
  assert.equal(secondLoad.migratedAssetCount, 0);

  const directSaveRoot = path.join(tempRoot, 'direct-save');
  const directSaveStore = createPersistedConfigStore({ userDataPath: directSaveRoot });
  const directSaveResult = directSaveStore.save(legacyConfig) as {
    ok: boolean;
    migratedAssetCount: number;
  };
  assert.equal(directSaveResult.ok, true);
  assert.equal(directSaveResult.migratedAssetCount, 4);
  assert.equal(legacyConfig.settings.chatBackgroundImageUrl, legacyBackground);
  assert.equal(
    fs.readFileSync(path.join(directSaveRoot, PRIMARY_FILE_NAME), 'utf8').includes(legacyBackground),
    false,
  );

  console.log('persisted config assets smoke ok');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
