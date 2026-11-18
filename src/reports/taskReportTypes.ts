// A task report as data (2026-11-09, report plugin). The character fills it in through the
// reports.show capability; the app turns it into a picture (taskReportTemplate.ts) so a long
// task does not end in a wall of text. Everything here is plain text and numbers.

export type ReportItemStatus = 'done' | 'attention' | 'failed' | 'skipped';

export interface ReportItem {
  label: string;
  /** One short line: where it went, why it failed, what the user has to decide. */
  note?: string;
  status: ReportItemStatus;
}

export interface ReportStep {
  label: string;
  /** How long it took, for the bar chart. */
  ms?: number;
  status: 'done' | 'failed' | 'skipped';
}

export interface ReportMetric {
  label: string;
  unit?: string;
  value: string;
}

export interface TaskReportData {
  /** Her picture (a data: URL); without one a paw sits in the ring. */
  avatarDataUrl?: string;
  characterName: string;
  /** Result checks (verify_goal): how many passed of how many. */
  checks?: { passed: number; total: number };
  createdAt: number;
  durationMs?: number;
  items: ReportItem[];
  metrics?: ReportMetric[];
  steps?: ReportStep[];
  subtitle?: string;
  suggestions?: string[];
  /** One line in her voice, shown in the summary panel. */
  summary?: string;
  title: string;
}

export const REPORT_SIZE = { height: 1024, width: 1536 } as const;

export const REPORT_LIMITS = {
  items: 60,
  labelChars: 40,
  metrics: 6,
  noteChars: 60,
  steps: 24,
  suggestions: 4,
  summaryChars: 120,
  titleChars: 28,
} as const;

function clip(value: unknown, max: number) {
  const text = typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const STATUSES: ReportItemStatus[] = ['done', 'attention', 'failed', 'skipped'];

/** Whatever came in (from the model), cut to what the picture can hold. */
export function normalizeTaskReport(input: Omit<Partial<TaskReportData>, 'items' | 'metrics' | 'steps' | 'suggestions'> & { items?: unknown; metrics?: unknown; steps?: unknown; suggestions?: unknown }): TaskReportData {
  const items = (Array.isArray(input.items) ? input.items : []).flatMap((raw): ReportItem[] => {
    const item = raw && typeof raw === 'object' ? raw as unknown as Record<string, unknown> : {};
    const label = clip(item.label, REPORT_LIMITS.labelChars);
    if (!label) return [];
    const status = STATUSES.includes(item.status as ReportItemStatus) ? item.status as ReportItemStatus : 'done';
    const note = clip(item.note, REPORT_LIMITS.noteChars);
    return [{ label, status, ...(note ? { note } : {}) }];
  }).slice(0, REPORT_LIMITS.items);
  const steps = (Array.isArray(input.steps) ? input.steps : []).flatMap((raw): ReportStep[] => {
    const step = raw && typeof raw === 'object' ? raw as unknown as Record<string, unknown> : {};
    const label = clip(step.label, 16);
    if (!label) return [];
    const ms = Number(step.ms);
    const status = step.status === 'failed' || step.status === 'skipped' ? step.status : 'done';
    return [{ label, status, ...(Number.isFinite(ms) && ms >= 0 ? { ms } : {}) }];
  }).slice(0, REPORT_LIMITS.steps);
  const metrics = (Array.isArray(input.metrics) ? input.metrics : []).flatMap((raw): ReportMetric[] => {
    const metric = raw && typeof raw === 'object' ? raw as unknown as Record<string, unknown> : {};
    const label = clip(metric.label, 10);
    const value = clip(String(metric.value ?? ''), 10);
    if (!label || !value) return [];
    const unit = clip(metric.unit, 6);
    return [{ label, value, ...(unit ? { unit } : {}) }];
  }).slice(0, REPORT_LIMITS.metrics);
  const suggestions = (Array.isArray(input.suggestions) ? input.suggestions : [])
    .map((text) => clip(text, 40)).filter(Boolean).slice(0, REPORT_LIMITS.suggestions);
  const passed = Number(input.checks?.passed);
  const total = Number(input.checks?.total);
  const durationMs = Number(input.durationMs);
  return {
    ...(typeof input.avatarDataUrl === 'string' && input.avatarDataUrl.startsWith('data:image/') ? { avatarDataUrl: input.avatarDataUrl } : {}),
    characterName: clip(input.characterName, 12) || '她',
    ...(Number.isFinite(passed) && Number.isFinite(total) && total > 0 ? { checks: { passed: Math.max(0, Math.min(total, Math.round(passed))), total: Math.round(total) } } : {}),
    createdAt: Number.isFinite(Number(input.createdAt)) && Number(input.createdAt) > 0 ? Number(input.createdAt) : Date.now(),
    ...(Number.isFinite(durationMs) && durationMs > 0 ? { durationMs } : {}),
    items,
    ...(metrics.length ? { metrics } : {}),
    ...(steps.length ? { steps } : {}),
    ...(clip(input.subtitle, 40) ? { subtitle: clip(input.subtitle, 40) } : {}),
    ...(suggestions.length ? { suggestions } : {}),
    ...(clip(input.summary, REPORT_LIMITS.summaryChars) ? { summary: clip(input.summary, REPORT_LIMITS.summaryChars) } : {}),
    title: clip(input.title, REPORT_LIMITS.titleChars) || '任务报告',
  };
}

export function countReportItems(report: TaskReportData) {
  const counts: Record<ReportItemStatus, number> = { attention: 0, done: 0, failed: 0, skipped: 0 };
  for (const item of report.items) counts[item.status] += 1;
  return counts;
}

export function formatReportDuration(ms: number | undefined) {
  if (!ms || ms <= 0) return '';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 ? `${minutes}分${seconds % 60}秒` : `${minutes}分钟`;
}
