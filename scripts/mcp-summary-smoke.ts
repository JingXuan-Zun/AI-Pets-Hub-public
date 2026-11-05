import assert from 'node:assert/strict';
import { cleanMcpSummary, fallbackMcpSummary } from '../src/plugins/mcpSummary';

// The one-line summary on an MCP plugin's card: the model's sentence, cleaned; tool names without a model.

assert.equal(cleanMcpSummary('“让她能操作一个独立的 Chrome 浏览器，打开网页、点按钮、截图。”\n'), '让她能操作一个独立的 Chrome 浏览器，打开网页、点按钮、截图。', 'quotes and extra lines go');
assert.equal(cleanMcpSummary('\n\n**让她能查天气**'), '让她能查天气', 'markdown bold and leading blank lines go');
assert.equal(cleanMcpSummary('让'.repeat(80)).length, 60, 'long answers are cut');
assert.equal(fallbackMcpSummary([]), '', 'no tools, no summary');
assert.equal(fallbackMcpSummary(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => ({ name }))), '提供 7 个工具：a、b、c、d、e、f等', 'without a model: tool names');

console.log('mcp summary smoke ok: 5 checks');
