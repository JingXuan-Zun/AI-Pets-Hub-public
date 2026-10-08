import assert from 'node:assert/strict';
import { shouldRouteToAgentLoop } from '../src/agent/loop/agentLoopRouting';

const route = (instruction: string, enabled = true) => shouldRouteToAgentLoop({ enabled, instruction });
// Desktop operation tasks go to the loop.
assert.ok(route('打开 WeGame，点击「快捷安全登录」，登录后启动里面的英雄联盟。'));
assert.ok(route('打开浏览器搜索今天的科技新闻并打开第一个结果') === false, 'news lookup stays with the older agent tools');
assert.ok(route('在 QQ 里打开和张三的聊天窗口'));
assert.ok(route('启动鸣潮'));
// Older-agent domains and plain chat stay where they are.
assert.ok(!route('在桌面文件夹里新建一个 notes.txt'));
assert.ok(!route('帮我记住明天开会'));
assert.ok(!route('今天天气怎么样'));
assert.ok(!route('你好呀'));
// The settings switch turns routing off entirely.
assert.ok(!route('打开 WeGame', false));
console.log('agent loop routing smoke ok');
