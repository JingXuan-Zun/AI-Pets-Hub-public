

function createLaunchResult({
  action,
  app: selectedApp,
  error,
  forceNew,
  matches = [],
  ok,
  query,
  verification,
}) {
  const matchCount = Array.isArray(matches) ? matches.length : 0;
  const hasSelectedApp = Boolean(selectedApp);
  return {
    action,
    app: selectedApp ?? null,
    error: error || undefined,
    forceNew: Boolean(forceNew),
    matchCount,
    matches,
    ok: Boolean(ok),
    query,
    status: ok
      ? action === 'focused' ? 'focused-existing-window' : 'launched-new-process'
      : action === 'launched' ? 'launched-unverified'
        : matchCount > 1 ? 'multiple-candidates'
          : matchCount === 1 || hasSelectedApp ? 'launch-failed'
          : 'not-found',
    verification: verification ?? null,
  };
}

module.exports = { createLaunchResult };
