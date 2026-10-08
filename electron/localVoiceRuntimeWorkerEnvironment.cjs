const path = require('path');

function isInsideAnyDir(targetPath, directories, isPathInside) {
  return directories.some((directory) => directory && isPathInside(targetPath, directory));
}

function describeRuntimeEnvironment(context, candidate, executable) {
  const { normalizeComparablePath, isPathInside, isolatedRuntimeDirectories,
    projectRuntimeDirectories, portableRuntimeDirectories, normalizedBundledPythonPath } = context;
  const normalizedExecutable = normalizeComparablePath(executable);
  if (candidate?.label?.startsWith('venv-') || isInsideAnyDir(normalizedExecutable, isolatedRuntimeDirectories, isPathInside)) {
    return {
      kind: 'isolated',
      message: 'Using isolated Python runtime. Dependencies are separated from project Python.',
    };
  }
  if (isInsideAnyDir(normalizedExecutable, projectRuntimeDirectories, isPathInside)) {
    return {
      kind: 'project',
      message: 'Using project Python runtime. Install local dependencies to create isolated runtimes and reduce conflicts.',
    };
  }
  if (isInsideAnyDir(normalizedExecutable, portableRuntimeDirectories, isPathInside)) {
    return {
      kind: 'portable',
      message: 'Using portable Python runtime. Install local dependencies to create isolated runtimes and reduce conflicts.',
    };
  }
  if (normalizedBundledPythonPath === normalizedExecutable) {
    return {
      kind: 'bundled',
      message: 'Using bundled Python runtime. Install local dependencies to create isolated runtimes and reduce conflicts.',
    };
  }
  if (candidate?.label === 'manual') {
    return {
      kind: 'manual',
      message: 'Using manually configured Python runtime. Install local dependencies to create isolated runtimes and reduce conflicts.',
    };
  }
  return {
    kind: 'system',
    message: 'Still using shared or system Python. Install local dependencies to create isolated runtimes.',
  };
}

function createLocalVoiceWorkerEnvironment({ bundledPythonPath, getModeEnvDirectory, isPathInside,
  normalizeComparablePath, portableExecutableDir, projectRoot, runtimeRoot }) {
  const isolatedRuntimeDirectories = [
    getModeEnvDirectory(runtimeRoot, 'tts'),
    getModeEnvDirectory(runtimeRoot, 'stt'),
  ];
  const projectRuntimeDirectories = [
    path.join(projectRoot, 'python'),
    path.join(projectRoot, 'python-runtime'),
  ];
  const portableRuntimeDirectories = portableExecutableDir
    ? [
        path.join(portableExecutableDir, 'python'),
        path.join(portableExecutableDir, 'python-runtime'),
        path.join(portableExecutableDir, '..', 'python'),
        path.join(portableExecutableDir, '..', 'python-runtime'),
        path.join(portableExecutableDir, '..', '..', 'python'),
        path.join(portableExecutableDir, '..', '..', 'python-runtime'),
      ]
    : [];
  const normalizedBundledPythonPath = normalizeComparablePath(bundledPythonPath);

  const context = { normalizeComparablePath, isPathInside, isolatedRuntimeDirectories,
    projectRuntimeDirectories, portableRuntimeDirectories, normalizedBundledPythonPath };
  return { describeRuntimeEnvironment: describeRuntimeEnvironment.bind(null, context) };
}

module.exports = { createLocalVoiceWorkerEnvironment };
