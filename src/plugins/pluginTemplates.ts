// Starting files for plugins the user makes with their character. A tool plugin starts from a
// working MCP server with no dependencies (Node's built-ins only), so the dev assistant only fills
// in the tools and nothing has to be installed with npm before it runs.

export const MCP_SERVER_TEMPLATE = String.raw`// MCP server (stdio, newline-delimited JSON-RPC), no dependencies: run with "node server.mjs".
// Add tools to TOOLS below; everything else already speaks the protocol.
import readline from 'node:readline';

const SERVER_INFO = { name: '__PLUGIN_ID__', version: '0.1.0' };

/** Each tool: name, description (what it does, for the character), inputSchema, and run(args) → text. */
const TOOLS = [
  {
    name: 'echo',
    description: 'Example tool: returns the text it was given. Replace it with the real tools.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Text to return' } }, required: ['text'] },
    async run(args) {
      return String(args.text ?? '');
    },
  },
];

function send(message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
}

async function handle(request) {
  const { id, method, params = {} } = request;
  if (method === 'initialize') {
    return { protocolVersion: params.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: SERVER_INFO };
  }
  if (method === 'ping') return {};
  if (method === 'tools/list') {
    return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((item) => item.name === params.name);
    if (!tool) throw Object.assign(new Error('Unknown tool: ' + params.name), { code: -32602 });
    try {
      const text = await tool.run(params.arguments ?? {});
      return { content: [{ type: 'text', text: String(text) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: 'Error: ' + (error?.message ?? String(error)) }], isError: true };
    }
  }
  if (id === undefined) return undefined; // notifications (e.g. notifications/initialized) get no reply
  throw Object.assign(new Error('Method not found: ' + method), { code: -32601 });
}

readline.createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    send({ id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  try {
    const result = await handle(request);
    if (request.id !== undefined && result !== undefined) send({ id: request.id, result });
  } catch (error) {
    if (request.id !== undefined) send({ id: request.id, error: { code: error.code ?? -32603, message: error.message } });
  }
});
`;

/** The dev assistant's brief for a tool plugin, written into the draft folder next to the template. */
export function buildToolPluginTask(spec: { id: string; name: string; description: string; tools: string; notes: string }) {
  return [
    `在当前文件夹里把一个 MCP 工具插件做完：插件 id「${spec.id}」，名字「${spec.name}」。`,
    `它做什么：${spec.description}`,
    `需要的工具（名字、参数、返回什么）：\n${spec.tools}`,
    spec.notes ? `补充要求：${spec.notes}` : '',
    '',
    '做法：',
    '1. server.mjs 已经是能运行的 MCP 服务器（只用 Node 内置模块）。只改 TOOLS 数组：删掉示例 echo，按上面的要求写真正的工具，description 写清楚给角色看什么时候用、参数是什么。',
    '2. 尽量只用 Node 内置模块和全局 fetch，不要引入 npm 依赖；确实需要依赖时写进 package.json，并在 plugin.json 的 setup 里写清楚要先运行 npm install。',
    '3. 不要读写这个文件夹以外的文件，除非工具本身就是要读用户指定的路径；不要把密钥写进代码，需要密钥时从环境变量读，并在 plugin.json 的 mcp.env 里列出变量名（值留空）、setup 里写清楚去哪里拿。',
    '4. 更新 plugin.json：description、useWhen、examples、troubleshooting 写给普通用户看；permissions 按实际情况选（network 联网、run-program 运行程序、change-computer 改动电脑…）。mcp.command 保持 "node"、args 保持 ["server.mjs"]。',
    '5. 自测：用 node 写一个临时脚本，依次发 initialize、tools/list、对每个工具发一次 tools/call，确认都能正常返回，然后删掉临时脚本。',
    '6. 做完用中文简短说明：做了哪些工具、自测结果、用户要自己准备什么（比如密钥）。',
  ].filter((line) => line !== '').join('\n');
}

export function buildToolPluginManifest(spec: { id: string; name: string; description: string; author: string }) {
  return `${JSON.stringify({
    author: spec.author,
    description: spec.description,
    id: spec.id,
    kind: 'mcp',
    mcp: { args: ['server.mjs'], command: 'node' },
    name: spec.name,
    permissions: ['run-program'],
    requires: [{ install: 'https://nodejs.org', name: 'Node.js 18 或更新' }],
    version: '0.1.0',
  }, null, 2)}\n`;
}

export function buildSkillMarkdown(spec: { id: string; name: string; description: string; instructions: string }) {
  const oneLine = (text: string) => text.replace(/\s+/gu, ' ').trim();
  return [
    '---',
    `name: ${spec.id}`,
    `description: ${oneLine(spec.description)}`,
    '---',
    '',
    `# ${oneLine(spec.name)}`,
    '',
    spec.instructions.trim(),
    '',
  ].join('\n');
}
