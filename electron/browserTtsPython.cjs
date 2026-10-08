const { getPythonCandidates } = require('./localVoiceRuntimePathUtils.cjs');
const { formatSpawnFailure } = require('./localVoiceRuntimeCommandUtils.cjs');
const { spawnCommand } = require('./browserTtsCommands.cjs');

const BROWSER_TTS_REQUIRED_PACKAGES = ['edge_tts'];

function createBrowserTtsPython(context) {
  const { projectRoot, runtimeRoot, getSharedEnv } = context;

  function getCandidate(settings) {
    const preferredPath = typeof settings?.localVoiceRuntimePath === 'string'
      ? settings.localVoiceRuntimePath.trim()
      : '';
    return getPythonCandidates(preferredPath, { projectRoot })[0] || null;
  }

  async function probePackages(candidate) {
    const script = [
      'import importlib.util',
      'missing = []',
      `packages = ${JSON.stringify(BROWSER_TTS_REQUIRED_PACKAGES)}`,
      'for package in packages:',
      '    if importlib.util.find_spec(package) is None:',
      '        missing.append(package)',
      'print("\\n".join(missing))',
    ].join('\n');
    const result = await spawnCommand(candidate, ['-c', script], {
      cwd: runtimeRoot,
      env: getSharedEnv(),
    });
    if (!result.ok) {
      return {
        ok: false,
        missingPackages: BROWSER_TTS_REQUIRED_PACKAGES,
        error: formatSpawnFailure(result),
      };
    }
    return {
      ok: true,
      missingPackages: result.stdout.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean),
      error: null,
    };
  }

  return { getCandidate, probePackages };
}

module.exports = { BROWSER_TTS_REQUIRED_PACKAGES, createBrowserTtsPython };
