const fs = require('fs');
const path = require('path');
const { pathExists } = require('./localVoiceRuntimePathUtils.cjs');
const { normalizeGptSovitsModelId, parseGptSovitsManifest } = require('./gptSovitsRules.cjs');

const MANIFEST_FILE = 'manifest.json';

function readManifest(modelDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(modelDir, MANIFEST_FILE), 'utf8'));
  } catch {
    return null;
  }
}

function describeModel(modelsRoot, id) {
  const modelDir = path.join(modelsRoot, id);
  const rawManifest = readManifest(modelDir);
  if (!rawManifest) {
    return { id, name: id, kind: 'full', description: '', author: '', ready: false, emotions: [], problems: ['manifest'] };
  }
  const parsed = parseGptSovitsManifest(rawManifest, modelDir);
  const problems = [...parsed.errors];
  if (parsed.gptPath && !pathExists(parsed.gptPath)) problems.push('gpt-file');
  if (parsed.sovitsPath && !pathExists(parsed.sovitsPath)) problems.push('sovits-file');
  const emotions = [];
  for (const [key, entry] of Object.entries(parsed.emotions)) {
    if (pathExists(entry.wavPath)) {
      emotions.push(key);
    } else {
      problems.push(`emotion-file:${key}`);
    }
  }
  return {
    id, name: parsed.name, kind: parsed.kind, description: parsed.description, author: parsed.author,
    ready: problems.length === 0, emotions, problems,
  };
}

// Junctions/symlinks to a model folder elsewhere are common, so links are followed.
function isDirectoryEntry(modelsRoot, entry) {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return fs.statSync(path.join(modelsRoot, entry.name)).isDirectory();
  } catch {
    return false;
  }
}

// Lists model folders by id only; no absolute paths leave the main process.
function listGptSovitsModels(modelsRoot) {
  if (!modelsRoot || !pathExists(modelsRoot)) {
    return [];
  }
  let entries = [];
  try {
    entries = fs.readdirSync(modelsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => normalizeGptSovitsModelId(entry.name) === entry.name && isDirectoryEntry(modelsRoot, entry))
    .map((entry) => describeModel(modelsRoot, entry.name))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function findGptSovitsModel(modelsRoot, modelId) {
  const id = normalizeGptSovitsModelId(modelId);
  if (!id || !modelsRoot) {
    return null;
  }
  return listGptSovitsModels(modelsRoot).find((model) => model.id === id) ?? null;
}

module.exports = { MANIFEST_FILE, findGptSovitsModel, listGptSovitsModels };
