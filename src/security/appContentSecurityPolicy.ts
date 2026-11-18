// Content-Security-Policy for every app window (pet, chat, settings), added to index.html
// as a <meta> tag by vite.config.ts.
//
// What it is for: scripts may only come from the app itself (plus the official Live2D Cubism
// Core, which cannot be bundled), never inline or through eval. Even if some text a character or
// web page produced ended up as HTML, it could not run code and reach the preload bridge.
//
// What stays open on purpose: network requests and media. Users point the app at any model or
// voice API (cloud, LAN, localhost), and images/videos come from those APIs, data/blob URLs,
// and local files through the desktop-pet-file: protocol.

export const LIVE2D_CUBISM_CORE_ORIGIN = 'https://cubism.live2d.com';

const LOCAL_FILE_SCHEME = 'desktop-pet-file:';

export function buildAppContentSecurityPolicy({ dev }: { dev: boolean }) {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Dev only: Vite's React Fast Refresh adds a small inline module script.
    'script-src': ["'self'", LIVE2D_CUBISM_CORE_ORIGIN, ...(dev ? ["'unsafe-inline'"] : [])],
    // React and the UI library set inline style attributes everywhere.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', LOCAL_FILE_SCHEME, 'https:', 'http:'],
    'media-src': ["'self'", 'data:', 'blob:', LOCAL_FILE_SCHEME, 'https:', 'http:'],
    'font-src': ["'self'", 'data:', LOCAL_FILE_SCHEME],
    'connect-src': ["'self'", 'data:', 'blob:', LOCAL_FILE_SCHEME, 'https:', 'http:', 'ws:', 'wss:'],
    'worker-src': ["'self'", 'blob:'],
    // Chat diagrams render in a sandboxed srcdoc frame.
    'frame-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
  };
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

export function injectContentSecurityPolicyMeta(html: string, policy: string) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/"/g, '&quot;')}" />`;
  if (!html.includes('<meta charset')) throw new Error('index.html has no <meta charset> to anchor the CSP tag');
  return html.replace(/(<meta charset[^>]*>)/i, `$1\n    ${meta}`);
}
