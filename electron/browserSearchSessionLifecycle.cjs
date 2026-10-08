const fs = require('fs');
const { spawn } = require('child_process');
const { waitForDevTools } = require('./browserSearchDevToolsWait.cjs');

function launchBrowserIfNeeded(session, { browserPath, port, profilePath }) {
    if (session.process && !session.process.killed) {
      return;
    }

    session.state.manualCloseRequested = false;
    fs.mkdirSync(profilePath, { recursive: true });
    session.process = spawn(browserPath, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profilePath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      'about:blank',
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });

    session.process.unref();
    session.process.on('exit', () => {
      session.process = null;
      session.state = {
        browserLabel: null,
        port: null,
        profilePath: null,
        manualCloseRequested: true,
        status: 'closed',
      };
    });
  }

async function ensureBrowserSession(session, { browserPath, port, profilePath, browserLabel }) {
    if (session.state.manualCloseRequested && !session.process) {
      session.state = {
        browserLabel: session.state.browserLabel || browserLabel,
        port: session.state.port || port,
        profilePath: session.state.profilePath || profilePath,
        manualCloseRequested: true,
        status: 'closed',
      };
      return { launched: false, blockedByManualClose: true };
    }

    if (session.process && !session.process.killed) {
      session.state = {
        browserLabel,
        port,
        profilePath,
        manualCloseRequested: false,
        status: 'running',
      };
      return { launched: false, blockedByManualClose: false };
    }

    launchBrowserIfNeeded(session, { browserPath, port, profilePath });
    session.state = {
      browserLabel,
      port,
      profilePath,
      manualCloseRequested: false,
      status: 'starting',
    };
    await waitForDevTools(port);
    session.state.status = 'running';
    return { launched: true, blockedByManualClose: false };
  }

function getSessionState(session) {
    return {
      ...session.state,
      isOpen: Boolean(session.process && !session.process.killed),
    };
  }

function closeSession(session) {
    if (!session.process || session.process.killed) {
      session.state = {
        browserLabel: null,
        port: null,
        profilePath: null,
        manualCloseRequested: true,
        status: 'closed',
      };
      return;
    }

    try {
      session.state.manualCloseRequested = true;
      session.process.kill();
    } catch {
      // Ignore process cleanup errors.
    }

    session.process = null;
    session.state = {
      browserLabel: null,
      port: null,
      profilePath: null,
      manualCloseRequested: true,
      status: 'closed',
    };
  }

function createBrowserSessionLifecycle() {
  const session = { process: null, state: {
    browserLabel: null,
    port: null,
    profilePath: null,
    manualCloseRequested: false,
    status: 'idle',
  } };
  return {
    ensureBrowserSession: (options) => ensureBrowserSession(session, options),
    getSessionState: () => getSessionState(session),
    closeSession: () => closeSession(session),
    clearManualCloseRequest: () => { session.state.manualCloseRequested = false; },
  };
}

module.exports = { createBrowserSessionLifecycle };
