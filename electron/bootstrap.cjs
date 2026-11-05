const Module = require('module');
const path = require('path');
const { app } = require('electron');
const {
  MAX_ATTEMPTS,
  checkVersionFolder,
  readState,
  updatesRoot,
  versionFolder,
  writeState,
} = require('./appUpdateShell.cjs');

// The app's entry point, and the one file a hot update never replaces: it decides whether this
// launch runs the code inside the exe or a downloaded newer version (userData/app-updates/v…).
// A version that fails to bring its window up twice is set aside and the exe's own code runs
// again, so a bad update cannot lock anyone out.

const builtInPackage = require('../package.json');
const PROBE_ENV = [
  'DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR',
  'DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR',
  'DESKTOP_PET_NEURAL_PERSONA_PROBE_USER_DATA_DIR',
  'DESKTOP_PET_PACKAGED_USER_DATA_DIR',
];

function runBuiltIn(notice = null) {
  global.__appUpdateBoot = { builtIn: true, markGood: () => undefined, notice, version: builtInPackage.version };
  require('./main.cjs');
}

function boot() {
  // Development and the packaged test probes always run the code they were started with;
  // DESKTOP_PET_APP_UPDATE_TEST lets a development run try the loader itself.
  const testing = process.env.DESKTOP_PET_APP_UPDATE_TEST === '1';
  if ((!app.isPackaged && !testing) || PROBE_ENV.some((name) => process.env[name]) || process.argv.includes('--local-test')) {
    runBuiltIn();
    return;
  }
  const root = updatesRoot(app.getPath('userData'));
  const state = readState(root);
  const checkFolder = (candidate) => checkVersionFolder(versionFolder(root, candidate), { builtInPackage, electronVersion: process.versions.electron, version: candidate });
  /** The last version that worked, to go back to instead of the exe's own when it still fits. */
  const fallbackFor = (current, failedVersion) => {
    const good = current.good;
    return good && good !== failedVersion && !(current.bad ?? []).includes(good) && !checkFolder(good) ? good : null;
  };
  const backTo = (fallback) => (fallback ? `v${fallback}` : `安装包自带的 v${builtInPackage.version}`);
  let notice = state.notice ?? null;
  if (state.pending) {
    state.active = state.pending;
    state.pending = null;
    state.attempts = 0;
  }
  const version = state.active;
  if (!version) {
    if (notice) writeState(root, { ...state, notice: null });
    runBuiltIn(notice);
    return;
  }
  const folder = versionFolder(root, version);
  const problem = (state.bad ?? []).includes(version) ? 'bad' : checkFolder(version);
  if (problem || (state.attempts ?? 0) >= MAX_ATTEMPTS) {
    const failed = !problem || problem === 'bad';
    const fallback = failed ? fallbackFor(state, version) : null;
    // A newer exe makes an old update pointless: nothing to report then.
    notice = problem === 'not-newer' || problem === 'other-shell' ? null : `v${version} 没能正常启动，已经回到${backTo(fallback)}。`;
    writeState(root, { ...state, active: fallback, attempts: 0, bad: failed ? [...new Set([...(state.bad ?? []), version])] : state.bad ?? [], notice: fallback ? notice : null });
    if (fallback) {
      boot();
      return;
    }
    runBuiltIn(notice);
    return;
  }
  writeState(root, { ...state, attempts: (state.attempts ?? 0) + 1, notice: null });
  global.__appUpdateBoot = {
    builtIn: false,
    folder,
    /** Called once the main window has loaded: this version works. */
    markGood() {
      const current = readState(root);
      if (current.active === version) writeState(root, { ...current, attempts: 0, good: version });
    },
    notice,
    version,
  };
  // The update has no node_modules of its own: code in its folder also looks in the exe's.
  // (Module.globalPaths is only a copy of the lookup list, so pushing there changes nothing.)
  const appModules = path.join(app.getAppPath(), 'node_modules');
  const lookupPaths = Module._nodeModulePaths;
  Module._nodeModulePaths = function nodeModulePaths(from) {
    const paths = lookupPaths.call(this, from);
    return path.resolve(from).startsWith(path.resolve(folder)) ? [...paths, appModules] : paths;
  };
  try {
    require(path.join(folder, 'electron', 'main.cjs'));
  } catch (error) {
    // Half-started code cannot simply be swapped out: set it aside and start again.
    try {
      require('fs').appendFileSync(path.join(root, 'boot-errors.log'), `${new Date().toISOString()} v${version}: ${error?.stack ?? error}\n`);
    } catch {
      // nothing more to do
    }
    const current = readState(root);
    const fallback = fallbackFor(current, version);
    writeState(root, { ...current, active: fallback, attempts: 0, bad: [...new Set([...(current.bad ?? []), version])], notice: `v${version} 启动出错（${error?.message ?? error}），已经回到${backTo(fallback)}。` });
    app.relaunch();
    app.exit(1);
  }
}

boot();
