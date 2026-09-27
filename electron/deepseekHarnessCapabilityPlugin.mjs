// Keep the bridge self-contained: the packaged dsh runtime loads external
// plugins from their file URL and does not expose its internal tool package to
// the plugin's Node module resolver.
function defineTool(tool) {
  return tool;
}

export const name = 'ai-pets-capability-bridge';
export const inject = ['tools'];

function callBridge(route, path = '.') {
  return fetch(`${process.env.AI_PETS_HARNESS_BRIDGE_URL}${route}`, {
    body: JSON.stringify({ path }),
    headers: { Authorization: `Bearer ${process.env.AI_PETS_HARNESS_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
    method: 'POST',
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'capability-bridge-failed');
    return JSON.stringify(result);
  });
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    description: 'List files and folders inside the approved Workspace.', name: 'ai_pets_list_workspace',
    output: { render: (_args, value) => [{ text: value, type: 'text' }], schema: { type: 'string' } },
    parameters: { path: { description: 'Relative path inside Workspace.', type: 'string' } },
    execute: (args) => callBridge('/list', args.path),
  }));
  ctx.tools.register(defineTool({
    description: 'Read a small text file inside the approved Workspace.', name: 'ai_pets_read_workspace_text',
    output: { render: (_args, value) => [{ text: value, type: 'text' }], schema: { type: 'string' } },
    parameters: { path: { description: 'Relative file path inside Workspace.', required: true, type: 'string' } },
    execute: (args) => callBridge('/read', args.path),
  }));
}
