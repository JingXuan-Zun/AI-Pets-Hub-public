// What the main process says about hot updates (electron/appUpdateService.cjs).

/** current = running now; pending = runs after a restart; download = can be switched to here (newer or
 *  earlier); builtin = the installer's own version; install = a new exe this app downloads and switches
 *  to by itself; full / needs-full = only a full installer from its release page fits;
 *  failed = did not start before. */
export type AppUpdateAction = 'builtin' | 'current' | 'download' | 'failed' | 'full' | 'install' | 'needs-full' | 'pending';

export interface AppUpdateVersion {
  action: AppUpdateAction;
  kind: 'full' | 'hot';
  notes: string;
  /** Release page of a full installer. */
  page: string;
  publishedAt: string;
  size: number;
  version: string;
}

export interface AppUpdateStatus {
  autoDownload: boolean;
  /** Running the exe's own code (no hot update in use). */
  builtIn: boolean;
  builtInVersion: string;
  checkedAt: number;
  current: string;
  downloading: string | null;
  error: string;
  notice: string | null;
  /** Bytes of a new exe downloaded so far, while one is downloading. */
  progress?: { received: number; total: number } | null;
  ok: boolean;
  /** The version a restart switches to, when it is not the running one. */
  pending: string | null;
  /** How this copy runs: a full version comes as a new exe (portable) or a new installer (installed). */
  installKind?: 'installed' | 'portable' | null;
  versions: AppUpdateVersion[];
}
