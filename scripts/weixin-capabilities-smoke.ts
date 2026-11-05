import assert from 'node:assert/strict';

// WeChat from the chat: she posts a login QR code, waits in the background for the scan, asks
// for the phone's digits when WeChat wants them, and says when the person is connected.

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases += 1; };
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Account = { detail: string; id: string; label: string; owner: boolean; state: string };
let accounts: Account[] = [];
let login: { detail: string; state: string } | null = null;
const calls: string[] = [];
Object.assign(globalThis, {
  window: {
    desktopPetShell: {
      weixin: {
        cancelLogin: async () => { calls.push('cancel'); login = null; return { ok: true }; },
        startLogin: async (request: { label: string; owner: boolean }) => { calls.push(`start ${request.label} owner=${request.owner}`); login = { detail: 'https://liteapp.weixin.qq.com/q/abc', state: 'waiting-scan' }; return { ok: true, qrContent: 'https://liteapp.weixin.qq.com/q/abc' }; },
        status: async () => ({ accounts, login, running: true }),
        submitVerifyCode: async (code: string) => { calls.push(`code ${code}`); login = { detail: '请在手机微信上确认', state: 'scanned' }; return { ok: true }; },
      },
    },
  },
});

const { runPlatformCapability } = await import('../src/platform-capabilities/platformCapabilityRegistry');
const { startBackgroundTask } = await import('../src/agent/background/backgroundTasks');

const shown: Array<{ caption: string; image: { dataUrl: string; name: string } }> = [];
const told: string[] = [];
const context = {
  configRef: { current: { settings: { weixinBridge: { enabled: true, voiceReplyMode: 'always' } } } },
  onUpdateConfig: () => {},
  presentImages: (images: Array<{ dataUrl: string; name: string }>, caption: string) => images.forEach((image) => shown.push({ caption, image })),
  // As the chat does it: the result is said when the wait ends.
  runInBackground: (job: { kind: string; run: (signal: AbortSignal) => Promise<{ ok: boolean; text: string }>; title: string }) => {
    const started = startBackgroundTask({ kind: job.kind, onEnd: ({ status, text }) => { if (status !== 'cancelled') told.push(text); }, petId: null, run: job.run, title: job.title });
    return 'busy' in started ? { ok: false, text: `还在${started.busy.title}` } : { ok: true, text: 'started' };
  },
};
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context as never, { args, capability });

check((await run('weixin.status')).text, '微信连接开着。还没有人登录。', 'nobody yet');
const first = await run('weixin.login');
check([first.ok, calls, shown.length, shown[0].caption, shown[0].image.dataUrl.startsWith('data:image/png;base64,')], [true, ['start 我 owner=true'], 1, '微信登录二维码（给「我」扫）', true], 'first login is the user, QR drawn here and posted in the chat');
assert.match(first.text, /二维码已经发在聊天里了/u);
cases += 1;
accounts = [{ detail: '', id: 'a1', label: '我', owner: true, state: 'connected' }];
login = null;
await tick(1700);
check(told, ['「我」的微信连上了，以后在手机微信里给 ClawBot 发消息就能找到你。'], 'she is told once the scan is confirmed');

check((await run('weixin.login')).text, '已经有人连着了，这次是给谁扫？（比如“妈妈”）', 'a second person needs a name');
await run('weixin.login', { label: '妈妈' });
check(calls.at(-1), 'start 妈妈 owner=false', 'family member, not the owner');
login = { detail: '请输入手机微信上显示的数字', state: 'need-verify' };
await tick(1700);
assert.match(told.at(-1) ?? '', /手机微信上显示了一串数字/u);
cases += 1;
check((await run('weixin.submit_code', { code: '12 34' })).ok, true, 'digits typed in');
check(calls.at(-1), 'code 1234', 'only the digits');
accounts = [...accounts, { detail: '', id: 'a2', label: '妈妈', owner: false, state: 'connected' }];
login = null;
await tick(1700);
check(told.at(-1), '「妈妈」的微信连上了，以后在手机微信里给 ClawBot 发消息就能找到你。', 'after the digits she still says who');
cases += 1;
check((await run('weixin.status')).text, '微信连接开着。我（主人）：已连接；妈妈：已连接。', 'both connected');

console.log(`weixin capabilities smoke ok: ${cases} checks`);
process.exit(0);
