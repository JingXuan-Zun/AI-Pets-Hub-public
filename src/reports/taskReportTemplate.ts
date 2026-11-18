// The task report as a dark-neon picture page (2026-11-09). A full HTML page with no scripts and
// no outside files; electron/reportImageRenderer.cjs loads it in a hidden window and takes a
// picture (1536×1024).

import { escapeHtml as esc, hashText, icon, networkSvg, pawMark, statusRing } from './reportGraphics';
import { buildReportPage, headerHtml, panel } from './reportPageKit';
import {
  REPORT_SIZE,
  countReportItems,
  formatReportDuration,
  type ReportItem,
  type TaskReportData,
} from './taskReportTypes';

export const STATUS_STYLE = {
  attention: { color: '#ffc85c', icon: 'attention', label: '要你看' },
  done: { color: '#4fe3a8', icon: 'check', label: '完成' },
  failed: { color: '#ff6b8a', icon: 'cross', label: '没做成' },
  skipped: { color: '#8a94c8', icon: 'skip', label: '跳过' },
} as const;


function itemRows(items: ReportItem[], limit: number) {
  const shown = items.slice(0, limit).map((item) => {
    const style = STATUS_STYLE[item.status];
    return `<div class="row">${icon(style.icon, style.color, 20)}<div><div class="t">${esc(item.label)}</div>${item.note ? `<div class="n">${esc(item.note)}</div>` : ''}</div></div>`;
  }).join('');
  const rest = items.length - limit;
  return `${shown}${rest > 0 ? `<div class="more">还有 ${rest} 项…</div>` : ''}`;
}


function overviewBody(report: TaskReportData) {
  const counts = countReportItems(report);
  const total = report.items.length || 1;
  const segments = (['done', 'attention', 'failed', 'skipped'] as const)
    .map((status) => `<div style="width:${((counts[status] / total) * 100).toFixed(2)}%;background:${STATUS_STYLE[status].color};box-shadow:0 0 8px ${STATUS_STYLE[status].color}"></div>`).join('');
  const tiles = (['done', 'attention', 'failed'] as const)
    .map((status) => `<div class="tile"><div class="k">${STATUS_STYLE[status].label}</div><div class="v" style="color:${STATUS_STYLE[status].color};text-shadow:0 0 12px ${STATUS_STYLE[status].color}">${counts[status]}</div></div>`).join('');
  return `<div style="display:flex;gap:10px;margin-bottom:14px">${tiles}</div><div class="bar">${segments}</div>
<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:15px;color:#b9c2ff"><span>共 ${report.items.length} 项</span>${report.checks ? `<span>核对 ${report.checks.passed}/${report.checks.total}</span>` : ''}${report.durationMs ? `<span>用时 ${formatReportDuration(report.durationMs)}</span>` : ''}</div>`;
}

// Measured: a panel's padding + header take about 80px, one item row (label + note) about 50px.
const PANEL_CHROME = 80;
const ROW = 50;
const MORE = 24;
const rowsThatFit = (panelHeight: number) => Math.max(1, Math.floor((panelHeight - PANEL_CHROME - MORE) / ROW));

/** Without recorded steps the middle panel shows how the results split up instead of staying empty. */
function distributionBody(report: TaskReportData, width: number) {
  const counts = countReportItems(report);
  const max = Math.max(1, counts.done, counts.attention, counts.failed, counts.skipped);
  const rows = (['done', 'attention', 'failed', 'skipped'] as const).filter((status) => status !== 'skipped' || counts.skipped);
  const barRoom = width - 150;
  return rows.map((status) => {
    const style = STATUS_STYLE[status];
    const w = Math.max(6, Math.round((counts[status] / max) * barRoom));
    return `<div style="display:flex;align-items:center;gap:12px;margin:${rows.length > 3 ? 4 : 7}px 0"><span style="width:64px;font-size:15px;color:#cfd6ff">${style.label}</span><span style="height:14px;width:${w}px;border-radius:7px;background:${style.color};box-shadow:0 0 10px ${style.color}"></span><b style="font-size:16px;color:${style.color}">${counts[status]}</b></div>`;
  }).join('');
}

function stepsBody(report: TaskReportData, width: number, height: number) {
  const steps = report.steps ?? [];
  if (!steps.length) return distributionBody(report, width);
  const max = Math.max(1, ...steps.map((step) => step.ms ?? 0));
  const gap = 6;
  const barWidth = Math.max(8, (width - gap * (steps.length - 1)) / steps.length);
  const labels = steps.length <= 12;
  const bottom = labels ? 20 : 2;
  const room = height - bottom - 16;
  const bars = steps.map((step, index) => {
    const value = Math.max(0.04, (step.ms ?? 0) / max);
    const h = Math.round(value * room);
    const color = step.status === 'failed' ? '#ff6b8a' : step.status === 'skipped' ? '#8a94c8' : index % 2 ? '#7fd8ff' : '#a99bff';
    const x = index * (barWidth + gap);
    const cx = (x + barWidth / 2).toFixed(1);
    const seconds = step.ms ? `${step.ms >= 10_000 ? Math.round(step.ms / 1000) : (step.ms / 1000).toFixed(1)}s` : '';
    return `<rect x="${x.toFixed(1)}" y="${height - bottom - h}" width="${barWidth.toFixed(1)}" height="${h}" rx="3" fill="${color}" style="filter:drop-shadow(0 0 4px ${color})"/>`
      + (labels && seconds ? `<text x="${cx}" y="${height - bottom - h - 4}" fill="#e9ecff" font-size="12" text-anchor="middle">${seconds}</text>` : '')
      + (labels ? `<text x="${cx}" y="${height - 4}" fill="#9aa6e8" font-size="13" text-anchor="middle">${esc(step.label.slice(0, Math.max(2, Math.floor(barWidth / 14))))}</text>` : '');
  }).join('');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars}</svg>`;
}

function metricsBody(report: TaskReportData) {
  const metrics = report.metrics ?? [];
  if (!metrics.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:10px">${metrics.map((metric) => `<div class="tile" style="flex:1 1 30%"><div class="k">${esc(metric.label)}</div><div class="v" style="font-size:26px;color:#7fd8ff;text-shadow:0 0 10px #7fd8ff">${esc(metric.value)}<span style="font-size:15px;color:#9aa6e8;margin-left:4px">${esc(metric.unit ?? '')}</span></div></div>`).join('')}</div>`;
}

function verdictOf(report: TaskReportData) {
  const counts = countReportItems(report);
  const warn = Boolean(counts.failed || counts.attention);
  const text = counts.attention ? `有 ${counts.attention} 件事等你决定` : counts.failed ? `有 ${counts.failed} 项没做成` : '全部完成';
  const color = warn ? '#ffc85c' : '#4fe3a8';
  return `<div style="flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;border:1px solid ${color};background:rgba(10,16,52,.6);box-shadow:0 0 14px ${color}55">${icon(warn ? 'attention' : 'shield', color, 22)}<b style="font-size:18px;color:${color}">${text}</b></div>`;
}

/** Landscape: no header row; verdict + her line on top, suggestions as chips below. */
function summaryStrip(report: TaskReportData) {
  const line = report.summary ? `<div style="flex:1;min-width:0;font-size:17px;line-height:1.5;color:#e9ecff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">“${esc(report.summary)}”</div>` : '';
  const tips = (report.suggestions ?? []).map((tip) => `<div style="display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(255,210,122,.08);border:1px solid rgba(255,210,122,.35);font-size:15px;color:#f1e6c8;white-space:nowrap">${icon('spark', '#ffd27a', 16)}${esc(tip)}</div>`).join('');
  return `<div style="display:flex;align-items:center;gap:16px"><div style="flex:none;display:flex;align-items:center;gap:8px">${icon('bulb', '#ffd27a', 24)}<b style="font-size:21px;color:#f1f3ff;letter-spacing:1px">总结与建议</b></div>${verdictOf(report)}${line}</div>${tips ? `<div style="display:flex;gap:10px;margin-top:12px;overflow:hidden">${tips}</div>` : ''}`;
}

function heroHtml(report: TaskReportData, x: number, y: number, size: number) {
  const counts = countReportItems(report);
  const ava = Math.round(size * 0.34);
  const avatar = report.avatarDataUrl ? `<img src="${esc(report.avatarDataUrl)}" alt="">` : pawMark(Math.round(ava * 0.55));
  const orbs = [
    { angle: -90, color: '#4fe3a8', count: counts.done, label: '完成' },
    { angle: -18, color: '#ffc85c', count: counts.attention, label: '要你看' },
    { angle: 54, color: '#7fd8ff', count: report.checks ? `${report.checks.passed}/${report.checks.total}` : '—', label: '核对' },
    { angle: 126, color: '#a99bff', count: formatReportDuration(report.durationMs) || '—', label: '用时' },
    { angle: 198, color: '#ff6b8a', count: counts.failed, label: '没做成' },
  ];
  const orbSize = Math.round(size * 0.17);
  const radius = size * 0.36;
  const orbHtml = orbs.map((orb) => {
    const rad = (orb.angle * Math.PI) / 180;
    const left = size / 2 + Math.cos(rad) * radius - orbSize / 2;
    const top = size / 2 + Math.sin(rad) * radius - orbSize / 2;
    return `<div class="orb" style="left:${left.toFixed(0)}px;top:${top.toFixed(0)}px;width:${orbSize}px;height:${orbSize}px;border:2px solid ${orb.color};box-shadow:0 0 18px ${orb.color},inset 0 0 12px ${orb.color}66"><div class="l">${orb.label}</div><div class="c" style="color:${orb.color};font-size:${String(orb.count).length > 4 ? 15 : 22}px">${esc(String(orb.count))}</div></div>`;
  }).join('');
  const ring = statusRing(ava + 34, (['done', 'attention', 'failed', 'skipped'] as const).map((status) => ({ color: STATUS_STYLE[status].color, value: counts[status] })), 7);
  return `<div class="hero" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px">
${networkSvg(size, size, hashText(report.title + report.createdAt))}
<div class="platform" style="width:${Math.round(size * 0.62)}px;height:${Math.round(size * 0.13)}px;left:${Math.round(size * 0.19)}px;top:${Math.round(size * 0.8)}px"></div>
<div style="position:absolute;width:${ava + 34}px;height:${ava + 34}px;left:${(size - ava - 34) / 2}px;top:${(size - ava - 34) / 2}px">${ring}</div>
<div class="ava" style="width:${ava}px;height:${ava}px">${avatar}</div>${orbHtml}</div>`;
}


function failedTitle(report: TaskReportData) {
  return countReportItems(report).skipped ? '没做成 · 跳过' : '没做成';
}

function splitItems(report: TaskReportData) {
  return {
    attention: report.items.filter((item) => item.status === 'attention'),
    done: report.items.filter((item) => item.status === 'done'),
    failed: report.items.filter((item) => item.status === 'failed' || item.status === 'skipped'),
  };
}

function landscape(report: TaskReportData) {
  const { width, height } = REPORT_SIZE;
  const counts = countReportItems(report);
  const { attention, done, failed } = splitItems(report);
  const L = 'position:absolute;left:32px;width:420px';
  const R = 'position:absolute;right:32px;width:420px';
  // Three columns from 132 to 850, the summary strip under them.
  const columnsTop = 132;
  const columnsBottom = 850;
  const sideH = 228;
  const metricRows = Math.ceil((report.metrics?.length ?? 0) / 3);
  const metricsH = metricRows ? PANEL_CHROME + metricRows * 80 : 0;
  const doneH = columnsBottom - columnsTop - (metricsH ? metricsH + 16 : 0);
  return `<div class="stage" style="width:${width}px;height:${height}px"><div class="grid"></div><div class="stars"></div>
${headerHtml(report, '完成时间', `${report.characterName}的任务报告`)}
${panel('任务概况', 'flag', '#a99bff', overviewBody(report), `${L};top:${columnsTop}px;height:${sideH}px`)}
${panel('需要你处理', 'attention', '#ffc85c', attention.length ? itemRows(attention, rowsThatFit(sideH)) : '<div class="more">没有要你操心的事。</div>', `${L};top:${columnsTop + sideH + 17}px;height:${sideH}px`, attention.length ? `${attention.length} 项` : '')}
${panel(failedTitle(report), 'cross', '#ff6b8a', failed.length ? itemRows(failed, rowsThatFit(sideH)) : '<div class="more">全部做成了。</div>', `${L};top:${columnsBottom - sideH}px;height:${sideH}px`, failed.length ? `${failed.length} 项` : '')}
${heroHtml(report, 488, 100, 560)}
${panel('已完成', 'check', '#4fe3a8', done.length ? itemRows(done, rowsThatFit(doneH)) : '<div class="more">还没有完成的项。</div>', `${R};top:${columnsTop}px;height:${doneH}px`, `${counts.done} 项`)}
${metricsH ? panel('数据', 'chart', '#7fd8ff', metricsBody(report), `${R};top:${columnsBottom - metricsH}px;height:${metricsH}px`) : ''}
${panel(report.steps?.length ? '步骤与用时' : '结果分布', report.steps?.length ? 'clock' : 'chart', '#7fd8ff', stepsBody(report, 564, 96), `position:absolute;left:468px;top:668px;width:600px;height:${columnsBottom - 668}px`)}
<div class="panel" style="position:absolute;left:32px;right:32px;top:866px;height:128px">${summaryStrip(report)}</div>
</div>`;
}

/** The whole page for one picture. */
export function buildTaskReportHtml(report: TaskReportData) {
  return buildReportPage(landscape(report));
}
