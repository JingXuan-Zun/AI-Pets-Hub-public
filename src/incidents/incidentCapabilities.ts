import type { PlatformCapability } from '../platform-capabilities/platformCapabilityTypes';
import { stringArg } from '../platform-capabilities/platformCapabilityArgs';
import { INCIDENT_SOURCE_LABELS, type Incident } from './incidentTypes';
import { clearIncidentConcerns } from './useIncidentConcern';

// She can look at the incidents ("病例") herself: "看看最近出了什么问题" → the list, then one in
// detail, and explain in plain words what probably happened and what the user can do. She only
// reads: changing code is the developer's call (docs/idea-inbox/self-evolution-20261103.md).

const bridge = () => (typeof window === 'undefined' ? undefined : window.desktopPetShell?.incidents);
const day = (at: number) => new Date(at).toLocaleString();

function line(item: Incident) {
  const fixed = item.fixedIn ? `，开发者已在 v${item.fixedIn} 修好` : '';
  return `- [${item.fingerprint.slice(0, 8)}] ${INCIDENT_SOURCE_LABELS[item.source]}：${item.title}（${item.count} 次，最近 ${day(item.lastAt)}，版本 ${item.versions.join('、')}${fixed}）`;
}

export const INCIDENT_CAPABILITIES: PlatformCapability[] = [
  {
    args: [],
    description: 'List the errors the app ran into recently (“病例”: crashes and unhandled errors, merged when they repeat) — for “最近出了什么问题”“刚才是不是崩了”. Read only.',
    describe: () => '看最近的问题',
    group: '体检',
    id: 'health.list_problems',
    risk: 'read',
    run: async () => {
      const shell = bridge();
      if (!shell) return { ok: false, text: '只有桌面版能看问题记录。' };
      const { consent, items } = await shell.list();
      if (!items.length) return { ok: true, text: '最近没有记下任何问题。' };
      const sending = consent === 'yes' ? '这些会自动发给开发者。' : consent === 'no' ? '用户选了不发给开发者。' : '用户还没决定要不要发给开发者（设置 → 健康）。';
      return { ok: true, text: `最近的问题（新的在前）：\n${items.slice(0, 15).map(line).join('\n')}\n${sending}\n要看某一条的细节，用 health.read_problem 加它的编号。` };
    },
    title: '看最近的问题',
  },
  {
    args: [{ description: 'The problem number from health.list_problems (first 8 characters are enough).', key: 'id', required: true, type: 'string' }],
    description: 'Read one recorded problem in detail: where in the code it happened and the log lines just before it, to explain what probably went wrong and what the user can do. Read only; you cannot change code — fixing it is up to the developer.',
    describe: (args) => `看问题 ${stringArg(args, 'id').slice(0, 8)}`,
    group: '体检',
    id: 'health.read_problem',
    risk: 'read',
    run: async (_context, args) => {
      const shell = bridge();
      if (!shell) return { ok: false, text: '只有桌面版能看问题记录。' };
      const item = await shell.get(stringArg(args, 'id'));
      if (!item) return { ok: false, text: '没有这个编号的问题，先用 health.list_problems 看看编号。' };
      const frames = item.frames.length ? item.frames.map((frame) => `  ${frame.fn} · ${frame.file}${frame.line ? `:${frame.line}` : ''}`).join('\n') : '  （没有出错位置）';
      return {
        ok: true,
        text: [
          line(item),
          `第一次出现：${day(item.firstAt)}`,
          `出错位置：\n${frames}`,
          `出错前的记录：\n${item.context.length ? item.context.map((entry) => `  ${entry}`).join('\n') : '  （没有）'}`,
          '用大白话告诉用户：大概是哪里出了问题、对他有什么影响、他现在能做什么（比如重试、体检、更新、换个设置）。猜的地方要说是猜的；改代码要交给开发者决定。',
        ].join('\n'),
      };
    },
    title: '看问题细节',
  },
  {
    args: [{ description: 'yes = send problem reports to the developer from now on; no = do not.', enumValues: ['yes', 'no'], key: 'send', required: true, type: 'string' }],
    description: 'Record the user\'s answer to "要不要把问题报告发给开发者" (after you asked about a problem, or when they say “以后出问题就反馈吧”/“别发给开发者”). Reports carry only the error and where it happened — no chat, keys or file paths. Changeable any time in Settings → 体检.',
    describe: (args) => (stringArg(args, 'send') === 'yes'
      ? '以后软件出问题时，自动把问题报告发给开发者（只有报错和出错位置，不含聊天内容、密钥和文件路径；设置 → 体检 里随时能关）'
      : '不把问题报告发给开发者（问题还是会记在 设置 → 体检 里给你看）'),
    group: '体检',
    id: 'health.set_report_consent',
    risk: 'change',
    run: async (_context, args) => {
      const shell = bridge();
      if (!shell) return { ok: false, text: '只有桌面版能设置这个。' };
      const send = stringArg(args, 'send') === 'yes';
      await shell.setConsent(send ? 'yes' : 'no');
      clearIncidentConcerns();
      return { ok: true, text: send ? '好了，以后出问题会自动发给开发者，开发者修好后设置里会提示更新。' : '好，不发。问题还是会记在 设置 → 体检 里。' };
    },
    title: '问题报告发不发',
  },
];
