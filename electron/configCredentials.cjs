const SECRET_FIELDS = ['deepseekHarnessApiKey', 'geminiApiKey', 'customApiKey',
  'visionCustomApiKey', 'tavilyApiKey', 'serperApiKey', 'braveSearchApiKey',
  'customWebSearchApiKey', 'browserTtsApiKey', 'customVoiceApiKey', 'customSpeechApiKey'];
const MODEL_FIELDS = ['geminiApiKey', 'customApiKey', 'visionCustomApiKey'];
const PREFIX = 'desktop-pet-credential:';

function transformSettings(config, transform) {
  if (!config?.settings) return config;
  const settings = { ...config.settings };
  for (const field of SECRET_FIELDS) settings[field] = transform(settings[field], field);
  return { ...config, settings };
}

function createConfigCredentialCodec(safeStorage) {
  function requireEncryption() {
    if (!safeStorage?.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') {
      throw new Error('credential-encryption-unavailable');
    }
  }
  function decode(config) {
    return transformSettings(config, (value) => {
      if (!value || typeof value !== 'object') return value;
      if (value.protectedCredential !== 1 || typeof value.ciphertext !== 'string') {
        throw new Error('invalid-protected-credential');
      }
      requireEncryption();
      try { return safeStorage.decryptString(Buffer.from(value.ciphertext, 'base64')); }
      catch { throw new Error('credential-decryption-failed'); }
    });
  }
  function encode(config, previous) {
    return transformSettings(config, (value, field) => {
      if (typeof value === 'string' && value.startsWith(PREFIX)) {
        if (value !== PREFIX + field || !previous?.settings?.[field]) {
          throw new Error('credential-reference-unavailable');
        }
        const urlField = field === 'customApiKey' ? 'customApiUrl'
          : field === 'visionCustomApiKey' ? 'visionCustomApiUrl' : null;
        if (urlField && String(config.settings[urlField] || '').trim() !== String(previous.settings[urlField] || '').trim()) {
          throw new Error('credential-endpoint-changed-reenter-key');
        }
        value = previous.settings[field];
      }
      if (!value) return value;
      if (typeof value !== 'string') throw new Error('invalid-credential');
      requireEncryption();
      try { return { protectedCredential: 1, ciphertext: safeStorage.encryptString(value).toString('base64') }; }
      catch { throw new Error('credential-encryption-failed'); }
    });
  }
  return { decode, encode };
}

function hasPlaintextCredentials(config) {
  return SECRET_FIELDS.some((field) => typeof config?.settings?.[field] === 'string' && config.settings[field]);
}

function modelCredentialReferences(config) {
  return transformSettings(config, (value, field) => MODEL_FIELDS.includes(field) && value ? PREFIX + field : value);
}

module.exports = { createConfigCredentialCodec, hasPlaintextCredentials, modelCredentialReferences };
