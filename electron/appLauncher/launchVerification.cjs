const { POST_LAUNCH_VERIFY_DELAY_MS, POST_LAUNCH_VERIFY_POLL_INTERVAL_MS } = require('./appLauncherConstants.cjs');

function createLaunchVerifier({ focusExistingAppWindow }) {
  function waitForMs(durationMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Math.round(Number(durationMs) || 0)));
    });
  }

  async function createLaunchVerification(action, query, selectedApp, options = {}) {
    const shouldPoll = Boolean(options?.delay);
    if (shouldPoll) {
      const deadline = Date.now() + POST_LAUNCH_VERIFY_DELAY_MS;
      do {
        const focusResult = await focusExistingAppWindow(query, selectedApp);
        if (focusResult.ok) {
          return {
            action,
            ok: true,
            reason: action === 'focused' ? 'existing-window-focused' : 'launched-window-detected',
            window: focusResult,
          };
        }

        if (Date.now() >= deadline) {
          return {
            action,
            ok: false,
            reason: focusResult.reason || 'window-not-detected-after-action',
            window: focusResult,
          };
        }

        await waitForMs(POST_LAUNCH_VERIFY_POLL_INTERVAL_MS);
      } while (true);
    }

    const focusResult = await focusExistingAppWindow(query, selectedApp);
    if (focusResult.ok) {
      return {
        action,
        ok: true,
        reason: action === 'focused' ? 'existing-window-focused' : 'launched-window-detected',
        window: focusResult,
      };
    }

    return {
      action,
      ok: false,
      reason: focusResult.reason || 'window-not-detected-after-action',
      window: focusResult,
    };
  }

  return { createLaunchVerification };
}

module.exports = { createLaunchVerifier };
