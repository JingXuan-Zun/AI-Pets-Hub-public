const SECRET_FIELDS = ['deepseekHarnessApiKey', 'geminiApiKey', 'customApiKey',
  'visionCustomApiKey', 'tavilyApiKey', 'serperApiKey', 'braveSearchApiKey',
  'customWebSearchApiKey', 'browserTtsApiKey', 'customVoiceApiKey', 'customSpeechApiKey', 'comfyUiApiKey', 'qqBridgeAccessToken', 'devAgentApiKey'];
const MODEL_FIELDS = ['geminiApiKey', 'customApiKey', 'visionCustomApiKey'];
const PREFIX = 'desktop-pet-credential:';
// Saved model API profiles (settings.apiProfiles, “接口配置”): each keeps its own key, encrypted
// like the fields above. The page only ever sees a reference to it; a reference may be copied
// into customApiKey / geminiApiKey to switch profile, or a field reference into a profile to
// save the current setup, and is only accepted when the endpoint is the one that key belongs to.
const PROFILE_REF = `${PREFIX}apiProfile:`;

function urlFieldOf(field) {
  return field === 'customApiKey' ? 'customApiUrl'
    : field === 'visionCustomApiKey' ? 'visionCustomApiUrl'
      : field === 'geminiApiKey' ? 'geminiApiUrl' : null;
}

function profileUrl(profile) {
  return String((profile?.llmProvider === 'gemini' ? profile?.geminiApiUrl : profile?.customApiUrl) || '').trim();
}

function profiles(settings) {
  return Array.isArray(settings?.apiProfiles) ? settings.apiProfiles.filter((item) => item && typeof item === 'object') : [];
}

function transformSettings(config, transform) {
  if (!config?.settings) return config;
  const settings = { ...config.settings };
  for (const field of SECRET_FIELDS) settings[field] = transform(settings[field], field);
  if (Array.isArray(settings.apiProfiles)) {
    settings.apiProfiles = profiles(settings).map((profile) => ({ ...profile, apiKey: transform(profile.apiKey, `apiProfile:${profile.id}`, profile) }));
  }
  return { ...config, settings };
}

/** What a reference points at in the previous (decrypted) config: the key and the endpoint it belongs to. */
function resolveReference(reference, previous) {
  if (reference.startsWith(PROFILE_REF)) {
    const profile = profiles(previous?.settings).find((item) => item.id === reference.slice(PROFILE_REF.length));
    return profile?.apiKey ? { url: profileUrl(profile), value: profile.apiKey } : null;
  }
  const field = reference.slice(PREFIX.length);
  const urlField = urlFieldOf(field);
  if (!SECRET_FIELDS.includes(field) || !previous?.settings?.[field]) return null;
  return { url: urlField ? String(previous.settings[urlField] || '').trim() : null, value: previous.settings[field] };
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
    return transformSettings(config, (value, field, profile) => {
      if (typeof value === 'string' && value.startsWith(PREFIX)) {
        const isOwn = value === PREFIX + field;
        // Only model keys may take another key's reference (switching or saving a profile).
        const mayBorrow = Boolean(profile) || MODEL_FIELDS.includes(field);
        if (!isOwn && !mayBorrow) throw new Error('credential-reference-unavailable');
        const resolved = resolveReference(value, previous);
        if (!resolved) throw new Error('credential-reference-unavailable');
        const targetUrl = profile ? profileUrl(profile) : urlFieldOf(field) ? String(config.settings[urlFieldOf(field)] || '').trim() : null;
        if (resolved.url !== null && targetUrl !== null && targetUrl !== resolved.url) {
          throw new Error('credential-endpoint-changed-reenter-key');
        }
        value = resolved.value;
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
  return SECRET_FIELDS.some((field) => typeof config?.settings?.[field] === 'string' && config.settings[field])
    || profiles(config?.settings).some((profile) => typeof profile.apiKey === 'string' && profile.apiKey && !profile.apiKey.startsWith(PREFIX));
}

function modelCredentialReferences(config) {
  return transformSettings(config, (value, field, profile) => ((profile || MODEL_FIELDS.includes(field)) && value ? PREFIX + field : value));
}

/** The key a profile reference stands for, if its endpoint is the one asked for (model requests). */
function resolveProfileCredential(reference, settings) {
  if (typeof reference !== 'string' || !reference.startsWith(PROFILE_REF)) return null;
  const profile = profiles(settings).find((item) => item.id === reference.slice(PROFILE_REF.length));
  return profile?.apiKey ? { apiKey: profile.apiKey, llmProvider: profile.llmProvider === 'gemini' ? 'gemini' : 'openai', url: profileUrl(profile) } : null;
}

module.exports = { createConfigCredentialCodec, hasPlaintextCredentials, modelCredentialReferences, resolveProfileCredential };
