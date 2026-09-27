function shouldInstallPackagedQuitTrace(options) {
  return Boolean(options?.app)
    && !options.isDev
    && !options.isLocalTest
    && options.env?.DESKTOP_PET_PACKAGED_SOAK_QUIT_TRACE === '1';
}

function createQuitTraceStack() {
  const stack = new Error('app.quit requested').stack || '';
  return stack
    .split(/\r?\n/)
    .slice(1, 7)
    .join('\n');
}

function installPackagedQuitTrace(options = {}) {
  const {
    app,
    env = process.env,
    isDev = false,
    isLocalTest = false,
    log = () => {},
  } = options;

  if (!shouldInstallPackagedQuitTrace({ app, env, isDev, isLocalTest })) {
    return { installed: false };
  }

  const originalQuit = app.quit.bind(app);
  app.quit = (...args) => {
    log('app.quit requested', { stack: createQuitTraceStack() });
    return originalQuit(...args);
  };

  log('app.quit trace installed');
  return { installed: true };
}

module.exports = {
  installPackagedQuitTrace,
  shouldInstallPackagedQuitTrace,
};
