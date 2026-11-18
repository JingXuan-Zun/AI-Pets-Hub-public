// Passing model failures are retried with a growing pause; lasting ones are not (2026-11-09).
import { strict as assert } from 'node:assert';
import { isTransientModelError, nextModelRetryDelay, waitBeforeRetry } from '../src/services/modelRetryPolicy';

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };

for (const message of [
  '连不上接口服务器（网络或代理问题）；国内用 Gemini 一般需要代理或中转地址。',
  '模型接口请求失败（HTTP 503），请检查配置后重试。',
  '模型响应读取失败',
  '请求太频繁了（每分钟限额），等一分钟再试。',
  'fetch failed',
  'socket hang up',
]) check(isTransientModelError(new Error(message)), true, `transient: ${message}`);

for (const message of [
  'API Key 无效，检查有没有填错或多了空格。',
  '找不到这个模型，检查模型名称有没有写对。',
  '这个 API Key 所在项目的余额用完了（402）。',
  '这个模型今天的次数用完了（每天限额），明天恢复，或换一个模型。',
  '模型请求失败（HTTP 400），请检查配置后重试。',
  '这次发送的内容太大了。',
]) check(isTransientModelError(new Error(message)), false, `not transient: ${message}`);

const outage = new Error('模型接口请求失败（HTTP 503），请检查配置后重试。');
check([1, 2, 3, 4].map((attempt) => nextModelRetryDelay(outage, attempt)), [2000, 5000, 10000, null], 'three growing pauses, then give up');
const badKey = new Error('API Key 无效');
check([1, 2].map((attempt) => nextModelRetryDelay(badKey, attempt)), [1000, null], 'anything else: one quick retry');

const controller = new AbortController();
const waiting = waitBeforeRetry(10_000, controller.signal);
controller.abort();
await assert.rejects(waiting); checks += 1;
await waitBeforeRetry(5); checks += 1;

console.log(`model retry policy smoke ok: ${checks} checks`);
