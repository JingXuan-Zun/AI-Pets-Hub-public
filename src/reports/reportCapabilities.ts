import { getDesktopPetSlot } from '../multiPetRoster';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { numberArg, stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityArgs } from '../platform-capabilities/platformCapabilityTypes';
import { buildMindMapHtml } from './mindMapTemplate';
import { normalizeMindMap, type MindMapData } from './mindMapTypes';
import { buildTaskReportHtml } from './taskReportTemplate';
import { countReportItems, normalizeTaskReport, type TaskReportData } from './taskReportTypes';

// The task report plugin (2026-11-09): after a task with many results she fills in the report as
// data and it is shown as one picture instead of a wall of text (QQ / WeChat relay it like any
// other picture). Nothing is changed, so it is a read.

const GROUP = '报告图';
const AVATAR_SIDE = 320;

/** Lists may come as real arrays (argsJson) or as a JSON string. */
function listArg(args: PlatformCapabilityArgs, key: string): unknown[] {
  const value = args[key];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Suggestions are often written one per line.
    return value.split(/\n+/u).map((line) => line.trim()).filter(Boolean);
  }
}

/** Her chat picture as a small square data: URL (the report page may only hold data: images). */
async function avatarDataUrl(url: string) {
  if (!url || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return '';
  try {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(AVATAR_SIDE, AVATAR_SIDE);
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 4, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE);
    bitmap.close();
    const blob = await canvas.convertToBlob({ quality: 0.88, type: 'image/jpeg' });
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export function readTaskReportArgs(args: PlatformCapabilityArgs, characterName: string): TaskReportData {
  const passed = numberArg(args, 'checks_passed');
  const total = numberArg(args, 'checks_total');
  const seconds = numberArg(args, 'duration_seconds');
  return normalizeTaskReport({
    characterName,
    ...(passed !== null && total !== null ? { checks: { passed, total } } : {}),
    createdAt: Date.now(),
    ...(seconds !== null ? { durationMs: seconds * 1000 } : {}),
    items: listArg(args, 'items'),
    metrics: listArg(args, 'metrics'),
    steps: listArg(args, 'steps'),
    subtitle: stringArg(args, 'subtitle'),
    suggestions: listArg(args, 'suggestions'),
    summary: stringArg(args, 'summary'),
    title: stringArg(args, 'title'),
  });
}

function reportBridge() {
  return typeof window === 'undefined' ? null : window.desktopPetShell?.reportImage ?? null;
}

const showTaskReport: PlatformCapability = {
  args: [
    { description: 'Short title of the task, e.g. “整理下载文件夹”.', key: 'title', required: true, type: 'string' },
    {
      description: 'JSON array of every result: [{"label":"发票_10月.pdf","status":"done","note":"移到 文档/发票"}]. status: done | attention (the user has to look or decide) | failed | skipped. note: one short line (where it went, why it failed, what to decide). Keep labels short.',
      key: 'items',
      required: true,
      type: 'string',
    },
    { description: 'One or two sentences in your own voice about how it went (optional).', key: 'summary', type: 'string' },
    { description: 'JSON array of up to 4 short next steps for the user (optional).', key: 'suggestions', type: 'string' },
    { description: 'JSON array of the main steps with time: [{"label":"扫描","ms":3200,"status":"done"}] (optional; status done | failed | skipped).', key: 'steps', type: 'string' },
    { description: 'JSON array of up to 6 key numbers: [{"label":"释放空间","value":"2.3","unit":"GB"}] (optional).', key: 'metrics', type: 'string' },
    { description: 'One line under the title, e.g. “下载文件夹 · 14 个文件” (optional).', key: 'subtitle', type: 'string' },
    { description: 'How many result checks passed (verify_goal), with checks_total (optional).', key: 'checks_passed', type: 'number' },
    { description: 'How many result checks were made (optional).', key: 'checks_total', type: 'number' },
    { description: 'How long the whole task took, in seconds (optional).', key: 'duration_seconds', type: 'number' },
  ],
  description: 'Show the end-of-task report as one picture instead of a long text list. Use it when a task you just did has 5 or more results to report (files sorted, items checked, steps done or failed). Put every result in items; the picture shows counts, what needs the user, what failed and what was done. After it is shown, say only one or two short lines (mainly what the user has to decide) and do not list the items again in text.',
  describe: (args) => `任务报告图：${stringArg(args, 'title').slice(0, 40) || '任务报告'}`,
  group: GROUP,
  id: 'reports.show_task_report',
  risk: 'read',
  run: async (context, args) => {
    const bridge = reportBridge();
    if (!bridge) return { ok: false, text: '报告图只能在桌面版里生成，这次用文字简短汇报吧。' };
    if (!context.presentImages) return { ok: false, text: '这里显示不了图片，这次用文字简短汇报吧。' };
    const slot = getDesktopPetSlot(context.configRef.current, context.petId ?? '');
    const report = readTaskReportArgs(args, slot?.personality.name ?? '');
    if (!report.items.length) return { ok: false, text: 'items 里没有结果：把每一项按 {"label","status","note"} 写进 JSON 数组再试。' };
    const avatar = await avatarDataUrl(slot?.personality.chatAvatarUrl?.trim() ?? '');
    const withAvatar = avatar ? { ...report, avatarDataUrl: avatar } : report;
    const picture = await bridge.render(buildTaskReportHtml(withAvatar));
    if (!picture.ok || !picture.dataUrl) {
      pushFrontendRuntimeLog('reports', 'task report render failed', { error: picture.error });
      return { ok: false, text: `报告图没生成出来（${picture.error ?? '未知原因'}），这次用文字简短汇报吧。` };
    }
    context.presentImages([{
      dataUrl: picture.dataUrl,
      mimeType: 'image/jpeg',
      name: `任务报告-${report.title}.jpg`,
      sizeBytes: picture.sizeBytes,
    }], '');
    const counts = countReportItems(report);
    const parts = [`完成 ${counts.done}`, counts.attention ? `要用户看 ${counts.attention}` : '', counts.failed ? `没做成 ${counts.failed}` : '', counts.skipped ? `跳过 ${counts.skipped}` : ''].filter(Boolean);
    return {
      ok: true,
      text: `报告图已经发在聊天里了（共 ${report.items.length} 项：${parts.join('，')}）。接下来只用一两句话说重点${counts.attention ? '，主要是要用户决定的事' : ''}，不要再逐条列出。`,
    };
  },
  title: '任务报告图',
};

export function readMindMapArgs(args: PlatformCapabilityArgs, characterName: string): MindMapData {
  return normalizeMindMap({
    branches: listArg(args, 'branches'),
    characterName,
    createdAt: Date.now(),
    subtitle: stringArg(args, 'subtitle'),
    summary: stringArg(args, 'summary'),
    title: stringArg(args, 'title'),
  });
}

// A plan, design or explanation with several parts, as a mind map (2026-11-09: a 3 600-character
// answer about a memory system was one wall of text; a fixed six-box layout looked the same for
// every topic, so the map grows with the content instead).
const showMindMap: PlatformCapability = {
  args: [
    { description: 'The topic in the middle, short, e.g. “神经网络记忆 + 思考”.', key: 'title', required: true, type: 'string' },
    {
      description: 'JSON array of 2-8 branches: [{"text":"关系网","children":[{"text":"关系本身是节点","notes":["A 对 B 和 B 对 A 各存一份"]},{"text":"张力会累积、会腐坏"}]}]. branch text up to 16 characters; up to 6 children per branch (up to 30 characters each), each with up to 3 short notes. Short phrases, not paragraphs.',
      key: 'branches',
      required: true,
      type: 'string',
    },
    { description: 'One line under the title (optional).', key: 'subtitle', type: 'string' },
    { description: 'The core idea in one sentence, in your own voice (optional).', key: 'summary', type: 'string' },
  ],
  description: 'Show a plan, design, architecture, comparison or explanation as a mind map picture instead of a long text. Use it when the user asks for a 方案 / 设计 / 规划 / 架构 / 思路 / 梳理 and your answer has 3 or more parts. Put the structure in branches and children (short phrases). After it is shown, say only one or two lines (the core idea) and ask which branch to go into; do not write the plan out again in text.',
  describe: (args) => `思维导图：${stringArg(args, 'title').slice(0, 40) || '思维导图'}`,
  group: GROUP,
  id: 'reports.show_mind_map',
  risk: 'read',
  run: async (context, args) => {
    const bridge = reportBridge();
    if (!bridge) return { ok: false, text: '思维导图只能在桌面版里生成，这次用文字简短说吧。' };
    if (!context.presentImages) return { ok: false, text: '这里显示不了图片，这次用文字简短说吧。' };
    const slot = getDesktopPetSlot(context.configRef.current, context.petId ?? '');
    const map = readMindMapArgs(args, slot?.personality.name ?? '');
    if (map.branches.length < 2) return { ok: false, text: 'branches 至少要两个分支：按 {"text","children":[{"text","notes"}]} 写成 JSON 数组再试。' };
    const avatar = await avatarDataUrl(slot?.personality.chatAvatarUrl?.trim() ?? '');
    const picture = await bridge.render(buildMindMapHtml(avatar ? { ...map, avatarDataUrl: avatar } : map));
    if (!picture.ok || !picture.dataUrl) {
      pushFrontendRuntimeLog('reports', 'mind map render failed', { error: picture.error });
      return { ok: false, text: `思维导图没生成出来（${picture.error ?? '未知原因'}），这次用文字简短说吧。` };
    }
    context.presentImages([{ dataUrl: picture.dataUrl, mimeType: 'image/jpeg', name: `思维导图-${map.title}.jpg`, sizeBytes: picture.sizeBytes }], '');
    return {
      ok: true,
      text: `思维导图已经发在聊天里了（${map.branches.length} 个分支：${map.branches.map((branch) => branch.text).join('、')}）。接下来只用一两句话说核心思路，问用户想先展开哪个分支，不要再把内容用文字写一遍。`,
    };
  },
  title: '思维导图',
};

export const REPORT_CAPABILITIES: PlatformCapability[] = [showTaskReport, showMindMap];
