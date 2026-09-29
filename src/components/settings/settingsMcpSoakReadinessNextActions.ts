export type SettingsMcpSoakReadinessNextActionStatus = 'blocked' | 'ready' | 'todo';

export interface SettingsMcpSoakReadinessNextAction {
  detail: string;
  id: string;
  label: string;
  status: SettingsMcpSoakReadinessNextActionStatus;
}

interface SettingsMcpSoakReadinessNextActionInput {
  configPresent: boolean;
  runbook: {
    indexReports: string;
    perServer: Array<{ command: string; serverId: string }>;
  };
  servers: Array<{
    blockers: string[];
    fakeFixture: boolean;
    readyForRealSoak: boolean;
    referenceServer: boolean;
  }>;
  source: string;
  totals: {
    readyServers: number;
    servers: number;
  };
}

function addAction(
  actions: SettingsMcpSoakReadinessNextAction[],
  action: SettingsMcpSoakReadinessNextAction,
) {
  actions.push(action);
}

function addConfigAction(
  actions: SettingsMcpSoakReadinessNextAction[],
  input: SettingsMcpSoakReadinessNextActionInput,
) {
  if (input.configPresent) {
    return;
  }

  addAction(actions, input.source === 'draft-config' ? {
    detail: 'Persist the draft before treating readiness as saved-config evidence.',
    id: 'save-draft-config',
    label: 'Save draft MCP config',
    status: 'todo',
  } : {
    detail: 'Create .desktop-pet-mcp.json or import a draft config before real soak.',
    id: 'create-saved-config',
    label: 'Create saved MCP config',
    status: 'todo',
  });
}

function addServerActions(
  actions: SettingsMcpSoakReadinessNextAction[],
  input: SettingsMcpSoakReadinessNextActionInput,
) {
  if (input.totals.servers === 0) {
    addAction(actions, {
      detail: 'Add at least one external MCP server entry.',
      id: 'add-mcp-server',
      label: 'Add MCP server',
      status: 'blocked',
    });
  }
  if (input.servers.some((server) => server.blockers.length > 0)) {
    addAction(actions, {
      detail: 'Resolve missing command or cwd checks before running soak commands.',
      id: 'fix-server-blockers',
      label: 'Fix server blockers',
      status: 'blocked',
    });
  }
  if (input.servers.some((server) => server.fakeFixture)) {
    addAction(actions, {
      detail: 'Fixture servers only prove smoke behavior, not real external MCP stability.',
      id: 'replace-fixtures',
      label: 'Replace fixture servers',
      status: 'todo',
    });
  }
  if (input.servers.some((server) => server.referenceServer)) {
    addAction(actions, {
      detail: 'Reference servers prove the local pipeline only; replace them with real external servers before claiming soak evidence.',
      id: 'replace-reference-servers',
      label: 'Replace reference servers',
      status: 'todo',
    });
  }
}

function addSoakActions(
  actions: SettingsMcpSoakReadinessNextAction[],
  input: SettingsMcpSoakReadinessNextActionInput,
) {
  if (input.totals.readyServers <= 0) {
    return;
  }

  addAction(actions, {
    detail: `Run ${input.runbook.perServer.length} generated per-server soak command(s).`,
    id: 'run-ready-server-soak',
    label: 'Run ready-server soak',
    status: 'ready',
  });
  if (input.runbook.indexReports) {
    addAction(actions, {
      detail: 'Index the generated report directory and import the soak summary.',
      id: 'index-and-import-soak',
      label: 'Index and import reports',
      status: 'ready',
    });
  }
}

export function createSettingsMcpSoakReadinessNextActions(
  input: SettingsMcpSoakReadinessNextActionInput,
) {
  const actions: SettingsMcpSoakReadinessNextAction[] = [];
  addConfigAction(actions, input);
  addServerActions(actions, input);
  addSoakActions(actions, input);
  return actions.length ? actions : [{
    detail: 'Readiness has no immediate follow-up.',
    id: 'no-follow-up',
    label: 'No follow-up',
    status: 'ready' as const,
  }];
}
