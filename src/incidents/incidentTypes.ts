// Incidents ("病例") as the main process keeps them (electron/incidents/incidentStore.cjs).

export type IncidentSource = 'crash' | 'main' | 'window';

export interface IncidentFrame {
  file: string;
  fn: string;
  line: string;
}

export interface Incident {
  /** Cleaned runtime-log lines from just before the latest occurrence (stay on this computer). */
  context: string[];
  count: number;
  fingerprint: string;
  firstAt: number;
  /** Set when the developer marked it fixed in a version. */
  fixedIn: string | null;
  frames: IncidentFrame[];
  kind: string;
  lastAt: number;
  source: IncidentSource;
  title: string;
  uploadedCount: number;
  versions: string[];
}

export type IncidentConsent = 'no' | 'unasked' | 'yes';

export interface IncidentSnapshot {
  consent: IncidentConsent;
  items: Incident[];
}

/** One incident as it would be sent: no context lines. */
export type IncidentUpload = Pick<Incident, 'fingerprint' | 'firstAt' | 'frames' | 'kind' | 'lastAt' | 'source' | 'title' | 'versions'> & { count: number };

export interface IncidentBridge {
  get: (fingerprint: string) => Promise<Incident | null>;
  list: () => Promise<IncidentSnapshot>;
  /** A brand-new problem while the user has not decided about reporting (pet window only). */
  onNew: (callback: (incident: Pick<Incident, 'fingerprint' | 'source' | 'title'>) => void) => () => void;
  preview: () => Promise<IncidentUpload[]>;
  remove: (fingerprint: string) => Promise<IncidentSnapshot>;
  setConsent: (value: 'no' | 'yes') => Promise<IncidentSnapshot>;
  uploadNow: () => Promise<IncidentSnapshot & { error?: string; ok: boolean; reason?: string; sent?: number }>;
}

export const INCIDENT_SOURCE_LABELS: Record<IncidentSource, string> = {
  crash: '进程崩溃',
  main: '后台出错',
  window: '界面出错',
};
