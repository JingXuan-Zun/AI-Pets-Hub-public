// "导出诊断信息": the report must never carry keys, tokens or the user's name (2026-11-05).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDiagnosticsReport, redactDiagnosticsText, redactLogLine, summarizeSettings } = require('../electron/diagnosticsExport.cjs');

// What people said or typed never leaves in the log part.
assert.equal(
  redactLogLine('[x][IPC] received desktop-pet:settings-action {type: send-chat-message, text: 今天辛苦啦}'),
  '[x][IPC] received desktop-pet:settings-action {type: send-chat-message, text: <略>}',
);
assert.equal(
  redactLogLine('第 1 轮调用了 2 个工具 {calls: type_text{"text": "我的秘密"} | web_search{"query": "某个关键词"}, failed: }'),
  '第 1 轮调用了 2 个工具 {calls: type_text{…} | web_search{…}, failed: }',
);
assert.equal(redactLogLine('知识库已挂接 {petName: 某角色, matchCount: 0}'), '知识库已挂接 {petName: <略>, matchCount: 0}');
assert.equal(
  redactLogLine('{type: send-chat-message, text: 加一行“测试,4”，然后保存, 再说一句}'),
  '{type: send-chat-message, text: <略>}',
  'commas inside what was said do not end the masking',
);
assert.equal(redactLogLine('{text: 你好, petName: 某角色, count: 2}'), '{text: <略>, petName: <略>, count: 2}');
assert.equal(redactLogLine('prompt cache usage {hitRate: 95, hitTokens: 38400}'), 'prompt cache usage {hitRate: 95, hitTokens: 38400}', 'numbers stay');

const home = 'C:\\Users\\alice';
const redact = (text) => redactDiagnosticsText(text, { homeDir: home, userName: 'alice' });

assert.equal(redact('读取 C:\\Users\\alice\\Desktop\\a.txt'), '读取 C:\\Users\\<user>\\Desktop\\a.txt');
assert.equal(redact('path C:/Users/alice/Downloads'), 'path C:/Users/<user>/Downloads');
assert.doesNotMatch(redact('key sk-abcdefghijklmnop1234'), /abcdefghijklmnop/u);
assert.doesNotMatch(redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def'), /eyJhbGci/u);
assert.doesNotMatch(redact('{apiKey: "AKIA1234567890SECRET"}'), /AKIA1234567890SECRET/u);
assert.doesNotMatch(redact('token=0123456789abcdef0123456789abcdef'), /0123456789abcdef0123456789abcdef/u);
assert.doesNotMatch(redact('gemini AIzaSyA-1234567890abcdefghijklmn'), /AIzaSyA-1234567890/u);
assert.equal(redact('第 3 轮调用了 1 个工具'), '第 3 轮调用了 1 个工具', 'ordinary log text stays');

const settings = summarizeSettings({ config: { desktopPets: [{}, {}], settings: { customApiKey: 'sk-secret-123456789', customApiUrl: 'https://api.deepseek.com/v1/chat/completions', customModelName: 'deepseek-flash', llmProvider: 'openai', memoryDepth: 32768 } } });
assert.equal(settings.apiHost, 'api.deepseek.com');
assert.equal(settings.characterCount, 2);
assert.ok(!JSON.stringify(settings).includes('secret'), 'the key is never in the summary');

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-'));
fs.mkdirSync(path.join(userDataDir, 'app-updates'));
fs.writeFileSync(path.join(userDataDir, 'app-updates', 'state.json'), JSON.stringify({ active: '0.4.0', good: '0.4.0' }));
const report = buildDiagnosticsReport({
  app: { getLocale: () => 'zh-CN', getVersion: () => '0.4.0', isPackaged: true },
  displays: [{ primary: true, scaleFactor: 1, size: { height: 1440, width: 3440 } }],
  logLines: ['[newest] prompt cache usage', `[older] key sk-zzzzzzzzzzzzzzzzzz at ${os.homedir()}\\x`],
  mcpConfig: { servers: { 'chrome-devtools': { env: { TOKEN: 'abc' } }, time: { disabled: true } } },
  persistedConfig: { config: { settings: { customApiKey: 'sk-zzzzzzzzzzzzzzzzzz', customApiUrl: 'https://api.deepseek.com', llmProvider: 'openai' } } },
  userDataDir,
});
assert.match(report, /AI Pets Hub 诊断信息/u);
assert.match(report, /3440x1440@1（主）/u);
assert.match(report, /chrome-devtools、time（已关）/u, 'plugin names only');
assert.doesNotMatch(report, /sk-zzzz/u, 'no key anywhere');
assert.ok(!report.includes(os.homedir()), 'no home folder path');
assert.ok(report.indexOf('[older]') < report.indexOf('[newest]'), 'logs oldest first');
fs.rmSync(userDataDir, { force: true, recursive: true });
console.log('diagnostics export smoke ok: 25 checks');
