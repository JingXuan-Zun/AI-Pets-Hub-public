const fs = require('fs');
const os = require('os');
const path = require('path');

function pathExists(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    return false;
  }

  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeComparablePath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    return '';
  }

  try {
    return path.resolve(targetPath).replace(/\//g, '\\').toLowerCase();
  } catch {
    return String(targetPath).replace(/\//g, '\\').toLowerCase();
  }
}

function isPathInside(targetPath, basePath) {
  const normalizedTarget = normalizeComparablePath(targetPath);
  const normalizedBase = normalizeComparablePath(basePath);
  if (!normalizedTarget || !normalizedBase) {
    return false;
  }

  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}\\`);
}

function uniqueStrings(items) {
  return [...new Set(items.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))];
}

function readFirstExistingTextFile(referencePath) {
  if (!pathExists(referencePath)) {
    return '';
  }

  const candidatePaths = [];
  const stats = fs.statSync(referencePath);

  if (stats.isFile()) {
    const parsed = path.parse(referencePath);
    candidatePaths.push(path.join(parsed.dir, `${parsed.name}.txt`));
  } else {
    const entries = fs.readdirSync(referencePath, { withFileTypes: true });
    entries
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.txt')
      .forEach((entry) => {
        candidatePaths.push(path.join(referencePath, entry.name));
      });
  }

  for (const candidatePath of candidatePaths) {
    try {
      const text = fs.readFileSync(candidatePath, 'utf8').trim();
      if (text) {
        return text;
      }
    } catch {
      // Ignore unreadable text files.
    }
  }

  return '';
}

function resolveReferenceTextFromAudioFileName(audioPath) {
  if (!audioPath || typeof audioPath !== 'string') {
    return '';
  }

  const fileNameText = path.parse(audioPath).name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!fileNameText) {
    return '';
  }

  const compactName = fileNameText.replace(/[\s._-]+/g, '').toLowerCase();
  const genericNames = [
    'audio',
    'clone',
    'prompt',
    'recording',
    'ref',
    'reference',
    'sample',
    'speaker',
    'stt',
    'take',
    'tts',
    'voice',
    'wav',
  ];
  const isGenericName = genericNames.some((name) => (
    compactName === name || (compactName.startsWith(name) && /^\d+$/.test(compactName.slice(name.length)))
  ));
  if (!compactName || /^\d+$/.test(compactName) || isGenericName) {
    return '';
  }

  const hasCjkText = /[\u3400-\u9fff]/u.test(fileNameText);
  const latinLetterCount = (fileNameText.match(/[A-Za-z]/g) || []).length;
  if (!hasCjkText && latinLetterCount < 2) {
    return '';
  }

  return fileNameText;
}

function resolveBundledPythonPath() {
  return path.join(
    os.homedir(),
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    'python.exe',
  );
}

function resolvePortableExecutableDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR && pathExists(process.env.PORTABLE_EXECUTABLE_DIR)) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }

  if (process.env.PORTABLE_EXECUTABLE_FILE && pathExists(process.env.PORTABLE_EXECUTABLE_FILE)) {
    return path.dirname(process.env.PORTABLE_EXECUTABLE_FILE);
  }

  return null;
}

function describeRuntimeCandidate(candidate) {
  if (!candidate) {
    return 'unknown';
  }

  return [candidate.executable, ...(Array.isArray(candidate.args) ? candidate.args : [])].join(' ').trim();
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate || !candidate.executable) {
      return false;
    }

    const key = describeRuntimeCandidate(candidate);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function collectKnownPythonCandidates(projectRoot) {
  const portableExecutableDir = resolvePortableExecutableDir();
  const processExecutableDir = process.execPath ? path.dirname(process.execPath) : null;
  const candidatePaths = [
    projectRoot ? path.join(projectRoot, 'python', 'python.exe') : null,
    projectRoot ? path.join(projectRoot, 'python-runtime', 'python.exe') : null,
    portableExecutableDir ? path.join(portableExecutableDir, 'python', 'python.exe') : null,
    portableExecutableDir ? path.join(portableExecutableDir, 'python-runtime', 'python.exe') : null,
    portableExecutableDir ? path.join(portableExecutableDir, '..', 'python', 'python.exe') : null,
    portableExecutableDir ? path.join(portableExecutableDir, '..', 'python-runtime', 'python.exe') : null,
    portableExecutableDir ? path.join(portableExecutableDir, '..', '..', 'python', 'python.exe') : null,
    portableExecutableDir ? path.join(portableExecutableDir, '..', '..', 'python-runtime', 'python.exe') : null,
    processExecutableDir ? path.join(processExecutableDir, 'python', 'python.exe') : null,
    processExecutableDir ? path.join(processExecutableDir, 'python-runtime', 'python.exe') : null,
    processExecutableDir ? path.join(processExecutableDir, '..', 'python', 'python.exe') : null,
    processExecutableDir ? path.join(processExecutableDir, '..', 'python-runtime', 'python.exe') : null,
    processExecutableDir ? path.join(processExecutableDir, '..', '..', 'python', 'python.exe') : null,
    processExecutableDir ? path.join(processExecutableDir, '..', '..', 'python-runtime', 'python.exe') : null,
  ].filter(Boolean);

  return candidatePaths
    .filter((candidatePath) => pathExists(candidatePath))
    .map((candidatePath, index) => ({
      label: `known-${index}`,
      executable: candidatePath,
      args: [],
    }));
}

function resolveRuntimeRoot({ app, projectRoot }) {
  const portableExecutableDir = resolvePortableExecutableDir();
  if (portableExecutableDir) {
    return path.join(portableExecutableDir, 'python', 'local-voice-runtime');
  }

  if (app?.isPackaged && process.execPath) {
    return path.join(path.dirname(process.execPath), 'python', 'local-voice-runtime');
  }

  if (projectRoot) {
    return path.join(projectRoot, 'python', 'local-voice-runtime');
  }

  if (app) {
    return path.join(app.getPath('userData'), 'local-voice-runtime');
  }

  return path.join(process.cwd(), 'python', 'local-voice-runtime');
}

function getPythonCandidates(preferredPath, options = {}) {
  const candidates = [];

  if (preferredPath && pathExists(preferredPath)) {
    candidates.push({
      label: 'manual',
      executable: preferredPath,
      args: [],
    });
  }

  candidates.push(...collectKnownPythonCandidates(options.projectRoot));

  const bundledPythonPath = resolveBundledPythonPath();
  if (pathExists(bundledPythonPath)) {
    candidates.push({
      label: 'bundled',
      executable: bundledPythonPath,
      args: [],
    });
  }

  candidates.push(
    {
      label: 'python',
      executable: 'python',
      args: [],
    },
    {
      label: 'py',
      executable: 'py',
      args: ['-3'],
    },
  );

  return uniqueCandidates(candidates);
}

module.exports = {
  describeRuntimeCandidate,
  ensureDir,
  getPythonCandidates,
  isPathInside,
  normalizeComparablePath,
  pathExists,
  readFirstExistingTextFile,
  resolveReferenceTextFromAudioFileName,
  resolveBundledPythonPath,
  resolvePortableExecutableDir,
  resolveRuntimeRoot,
  uniqueStrings,
};
