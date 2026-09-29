const fs = require('fs');
const { net, protocol } = require('electron');
const { pathToFileURL } = require('url');

const LOCAL_MODEL_PROTOCOL_SCHEME = 'desktop-pet-file';

if (protocol?.registerSchemesAsPrivileged) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_MODEL_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function decodeLocalModelProtocolPath(requestUrl) {
  const parsedUrl = new URL(requestUrl);
  const decodedPathname = decodeURIComponent(parsedUrl.pathname || '');

  if (process.platform === 'win32') {
    if (decodedPathname.startsWith('/unc/')) {
      return `\\\\${decodedPathname.slice('/unc/'.length).replace(/\//g, '\\')}`;
    }

    return decodedPathname.replace(/^\/+/u, '').replace(/\//g, '\\');
  }

  return decodedPathname;
}

function registerLocalModelProtocol(options = {}) {
  const normalizedOptions = typeof options === 'function'
    ? { log: options }
    : (options ?? {});
  const targetSession = normalizedOptions.session ?? null;
  const log = typeof normalizedOptions.log === 'function'
    ? normalizedOptions.log
    : () => {};
  const targetProtocol = targetSession?.protocol ?? protocol;

  if (!targetProtocol?.handle) {
    return;
  }

  targetProtocol.handle(LOCAL_MODEL_PROTOCOL_SCHEME, async (request) => {
    try {
      const localPath = decodeLocalModelProtocolPath(request.url);
      if (!localPath || !fs.existsSync(localPath)) {
        log('local-model-protocol missing file', {
          requestUrl: request.url,
          localPath,
        });
        return new Response('Not Found', { status: 404 });
      }

      return net.fetch(pathToFileURL(localPath).toString());
    } catch (error) {
      log('local-model-protocol failed', error?.stack || error);
      return new Response('Internal Error', { status: 500 });
    }
  });
}

module.exports = {
  LOCAL_MODEL_PROTOCOL_SCHEME,
  decodeLocalModelProtocolPath,
  registerLocalModelProtocol,
};
