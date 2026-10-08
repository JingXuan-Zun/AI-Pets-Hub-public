import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  executeAgentChatCommand,
  isAgentToolAvailableInMode,
} from '../src/agent/index.ts';
import { createAgentCommandFromPlannerDecision } from '../src/agent/agentPlanner.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';

const fallbackCommand = createAgentCommandFromPlannerDecision(
  '/agent 打开浏览器搜索 OpenAI 官网',
  null,
);
assert.equal(fallbackCommand?.kind, 'unsupported');
assert.equal(
  fallbackCommand?.toolCall?.name,
  undefined,
  'browser search must be selected by the planner, not by keyword fallback',
);

const searchCommand = createAgentCommandFromPlannerDecision(
  '/agent 打开浏览器搜索 OpenAI 官网',
  {
    args: {
      query: 'OpenAI 官网',
    },
    intent: 'tool',
    tool: 'browser_search',
  },
);
assert.equal(searchCommand?.kind, 'tool-call');
assert.equal(searchCommand?.toolCall?.name, 'browser_search');
assert.equal(searchCommand?.toolCall?.input.query, 'OpenAI 官网');

const modelCommand = createAgentCommandFromPlannerDecision(
  '/agent 用浏览器访问 https://example.com',
  {
    args: {
      url: 'https://example.com',
    },
    intent: 'tool',
    tool: 'browser_search',
  },
);
assert.equal(modelCommand?.kind, 'tool-call');
assert.equal(modelCommand?.toolCall?.name, 'browser_search');
assert.equal(modelCommand?.toolCall?.input.query, 'https://example.com');
assert.equal(isAgentToolAvailableInMode('browser_search', 'agent'), true);

const permissionRoute = buildAgentPermissionRoute(modelCommand!);
assert.equal(permissionRoute.status, 'needs-approval');
assert.equal(permissionRoute.maxRisk, 'launch');
assert.ok(permissionRoute.plan?.steps.some((step) => step.action.kind === 'browser-search'));

const originalBrowserSearch = desktopPetShellRuntime.browserSearch;
let capturedPayload: unknown = null;

try {
  desktopPetShellRuntime.browserSearch = async (payload?: unknown) => {
    capturedPayload = payload;
    return {
      browserLabel: 'Edge',
      ok: true,
      query: (payload as { query?: string })?.query,
      text: 'Example Domain',
      url: 'https://example.com/',
    };
  };

  const result = await executeAgentChatCommand(modelCommand!, {
    configRef: {
      current: {
        settings: {
          browserSearchBrowserPath: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          browserSearchDebugPort: 9223,
          browserSearchEngine: 'google',
          browserSearchUrlTemplate: '',
          globalKnowledgeBase: '',
        },
      },
    },
    desktopOrganizationRef: { current: null },
    lastDesktopOrganizationPlanRef: { current: null },
    lastLocalProjectInspectionRef: { current: null },
    onUpdateConfig: () => {},
    startDesktopIconPlacementRef: { current: null },
  } as any);

  assert.equal(result.ok, true);
  assert.equal((capturedPayload as { query?: string })?.query, 'https://example.com');
  assert.equal(
    (capturedPayload as { settings?: { browserSearchForceOpenBrowser?: boolean } })?.settings?.browserSearchForceOpenBrowser,
    true,
  );
  assert.equal(
    (capturedPayload as { settings?: { browserSearchEngine?: string } })?.settings?.browserSearchEngine,
    'google',
  );

  desktopPetShellRuntime.browserSearch = async () => ({
    browserLabel: 'Edge',
    error: 'The browser page opened, but no usable text was extracted.',
    ok: false,
    opened: true,
    query: 'OpenAI',
    url: 'https://www.google.com/search?q=OpenAI',
  });

  const openedResult = await executeAgentChatCommand(searchCommand!, {
    configRef: {
      current: {
        settings: {
          browserSearchBrowserPath: '',
          browserSearchDebugPort: 9223,
          browserSearchEngine: 'auto',
          browserSearchUrlTemplate: '',
          globalKnowledgeBase: '',
        },
      },
    },
    desktopOrganizationRef: { current: null },
    lastDesktopOrganizationPlanRef: { current: null },
    lastLocalProjectInspectionRef: { current: null },
    onUpdateConfig: () => {},
    startDesktopIconPlacementRef: { current: null },
  } as any);

  assert.equal(openedResult.ok, true);
  assert.match(openedResult.verification ?? '', /页面已打开/u);
} finally {
  desktopPetShellRuntime.browserSearch = originalBrowserSearch;
}

console.log('agent browser search tool smoke ok');
