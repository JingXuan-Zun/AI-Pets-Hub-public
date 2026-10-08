const APP_INDEX_CACHE_TTL_MS = 60000;
const APP_SHORTCUT_EXTENSIONS = new Set(['.appref-ms', '.lnk', '.url']);
const APP_EXECUTABLE_EXTENSIONS = new Set(['.exe', ...APP_SHORTCUT_EXTENSIONS]);
const USER_APP_MEMORY_FILE_NAME = 'local-app-memory.v1.json';
// open_resource hands paths to the shell like a double click; executables, scripts and
// shortcuts must go through launch_local_app instead.
const OPEN_PATH_BLOCKED_EXTENSIONS = new Set([
  '.appref-ms', '.application', '.bat', '.cmd', '.com', '.cpl', '.exe', '.gadget', '.hta',
  '.inf', '.jar', '.js', '.jse', '.lnk', '.msc', '.msi', '.msp', '.pif', '.ps1', '.psm1',
  '.reg', '.scf', '.scr', '.url', '.vbe', '.vbs', '.ws', '.wsc', '.wsf', '.wsh',
]);
const USER_APP_MEMORY_SCHEMA_VERSION = 1;
const USER_APP_MEMORY_MAX_ENTRIES = 200;
const FOCUS_WINDOW_TIMEOUT_MS = 2500;
const POST_LAUNCH_VERIFY_DELAY_MS = 650;
const POST_LAUNCH_VERIFY_POLL_INTERVAL_MS = 120;
// PowerShell startup is noticeably slower on a cold packaged desktop process.
// Keep the index bounded, but do not discard every Windows packaged app at the first cold-start timeout.
const PACKAGED_APP_INDEX_TIMEOUT_MS = 6000;
const PACKAGED_APP_LAUNCH_TIMEOUT_MS = 3000;
const APP_INDEX_MAX_SHORTCUT_DIRECTORIES = 220;
const APP_INDEX_MAX_SHORTCUTS = 600;
const APP_INDEX_MAX_EXECUTABLE_SCAN_DIRECTORIES = 40;
const APP_DISK_FALLBACK_MAX_ROOTS = 10;
const APP_DISK_FALLBACK_MAX_DIRECTORIES = 180;
const APP_DISK_FALLBACK_MAX_FILES = 900;
const APP_DISK_FALLBACK_MAX_DEPTH = 4;
const APP_DISK_FALLBACK_MAX_CANDIDATES = 12;
const BROWSER_CATEGORY_QUERIES = [
  '\u6d4f\u89c8\u5668',
  '\u7f51\u9875\u6d4f\u89c8\u5668',
  '\u9ed8\u8ba4\u6d4f\u89c8\u5668',
  'browser',
  'default browser',
  'internet',
  'internet browser',
  'web browser',
];

module.exports = {
  APP_INDEX_CACHE_TTL_MS,
  APP_SHORTCUT_EXTENSIONS,
  APP_EXECUTABLE_EXTENSIONS,
  USER_APP_MEMORY_FILE_NAME,
  OPEN_PATH_BLOCKED_EXTENSIONS,
  USER_APP_MEMORY_SCHEMA_VERSION,
  USER_APP_MEMORY_MAX_ENTRIES,
  FOCUS_WINDOW_TIMEOUT_MS,
  POST_LAUNCH_VERIFY_DELAY_MS,
  POST_LAUNCH_VERIFY_POLL_INTERVAL_MS,
  PACKAGED_APP_INDEX_TIMEOUT_MS,
  PACKAGED_APP_LAUNCH_TIMEOUT_MS,
  APP_INDEX_MAX_SHORTCUT_DIRECTORIES,
  APP_INDEX_MAX_SHORTCUTS,
  APP_INDEX_MAX_EXECUTABLE_SCAN_DIRECTORIES,
  APP_DISK_FALLBACK_MAX_ROOTS,
  APP_DISK_FALLBACK_MAX_DIRECTORIES,
  APP_DISK_FALLBACK_MAX_FILES,
  APP_DISK_FALLBACK_MAX_DEPTH,
  APP_DISK_FALLBACK_MAX_CANDIDATES,
  BROWSER_CATEGORY_QUERIES
};
