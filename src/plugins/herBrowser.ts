import { desktopPetShellRuntime } from '../desktopShellRuntime';
import type { PetConfig } from '../types';

// Her browser: the app's own Chrome window (its own data folder, separate from the user's
// Chrome and both of its profiles), where the user signs in her accounts once. A browser MCP
// plugin (chrome-devtools) connects to it with --browserUrl instead of opening a second Chrome,
// so her `browser` tool and the plugin work on the same window.
// (Chrome 136+ refuses remote control of its default data folder, so the user's own profiles
// cannot be used for this.)

const DEFAULT_PORT = 9223;
const BROWSER_URL_FLAGS = new Set(['--browserUrl', '--browser-url', '--browserurl', '-u']);

export function herBrowserPort(settings: Pick<PetConfig['settings'], 'browserSearchDebugPort'> | null | undefined) {
  const port = Number(settings?.browserSearchDebugPort);
  return Number.isFinite(port) && port >= 1024 && port <= 65535 ? Math.round(port) : DEFAULT_PORT;
}

export function herBrowserUrl(settings: Pick<PetConfig['settings'], 'browserSearchDebugPort'> | null | undefined) {
  return `http://127.0.0.1:${herBrowserPort(settings)}`;
}

/** True when the MCP server's arguments point it at her browser (--browserUrl http://127.0.0.1:<port>). */
export function connectsToHerBrowser(args: unknown, port: number) {
  if (!Array.isArray(args)) return false;
  const values = args.flatMap((arg, index) => {
    if (typeof arg !== 'string') return [];
    const [flag, inline] = arg.split(/=(.*)/su);
    if (!BROWSER_URL_FLAGS.has(flag)) return [];
    return [inline ?? (typeof args[index + 1] === 'string' ? args[index + 1] as string : '')];
  });
  return values.some((value) => {
    try {
      const url = new URL(value);
      return ['127.0.0.1', 'localhost'].includes(url.hostname) && Number(url.port) === port;
    } catch {
      return false;
    }
  });
}

/** Opens her browser when it is not running (the plugin only connects to it). */
export async function ensureHerBrowser(settings: PetConfig['settings']) {
  const result = await desktopPetShellRuntime.controlBrowser({ action: 'open_browser', forceOpen: true, settings }) as { error?: string | null; ok?: boolean };
  return result?.ok ? { ok: true as const } : { error: result?.error || '她的浏览器没有打开。', ok: false as const };
}

const BROWSER_PLUGIN = /^chrome-devtools-mcp(?:@|$)/u;

/**
 * chrome-devtools added from its README opens a Chrome of its own; pointed at her browser it
 * works in the window she already uses (and where her accounts are signed in). Other servers
 * and ones already given a browser are left as they are.
 */
export function pointAtHerBrowser(args: string[], browserUrl: string) {
  if (!args.some((arg) => BROWSER_PLUGIN.test(arg))) return { args, changed: false };
  const hasBrowser = args.some((arg) => BROWSER_URL_FLAGS.has(arg.split('=')[0]) || arg === '--wsEndpoint' || arg.startsWith('--wsEndpoint='));
  if (hasBrowser) return { args, changed: false };
  return { args: [...args.filter((arg) => arg !== '--isolated'), `--browserUrl=${browserUrl}`], changed: true };
}
