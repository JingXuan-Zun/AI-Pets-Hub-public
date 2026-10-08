const path = require('path');
const { resolveRuntimeRoot } = require('./localVoiceRuntimePathUtils.cjs');

function createLocalVoiceRuntimePaths({ app, projectRoot, generatedAudioManifestFile }) {
  const runtimeRoot = resolveRuntimeRoot({ app, projectRoot });
  const embeddedRunnerPath = path.join(__dirname, 'local_voice_runner.py');
  const generatedAudioCacheRoot = path.join(runtimeRoot, 'generated-audio-cache');
  const generatedAudioManifestPath = path.join(generatedAudioCacheRoot, generatedAudioManifestFile);
  const referenceTextCachePath = path.join(runtimeRoot, 'reference-text-cache.json');
  return { runtimeRoot, embeddedRunnerPath, generatedAudioCacheRoot, generatedAudioManifestPath, referenceTextCachePath };
}

module.exports = { createLocalVoiceRuntimePaths };
