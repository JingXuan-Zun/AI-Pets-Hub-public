import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowAgreementReportFromResults,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentProductionSession,
  runAgentSessionV3PilotDiagnosticSampleRunner,
  stringifyAgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2Result,
  type AgentSessionV3PilotDiagnosticSampleRunnerResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

export interface AgentSessionV3PilotExplicitDebugScenarioResult {
  label: string;
  result: AgentSessionV2Result;
}

export interface RunAgentSessionV3PilotExplicitDebugCorpusExporterOptions {
  includeJsonText?: boolean;
  maxShadowDebugSamples?: number;
  outPath?: string | null;
  prettyJson?: boolean;
  settings?: PetConfig['settings'];
}

export interface AgentSessionV3PilotExplicitDebugCorpusExporterResult {
  corpusPath: string | null;
  diagnosticRun: AgentSessionV3PilotDiagnosticSampleRunnerResult;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-explicit-debug-corpus-exporter';
  scenarioCount: number;
  summaryText: string;
  version: 1;
}

function createAgentSessionV3PilotExplicitDebugShadowOptions() {
  return {
    debugSummary: {
      enabled: true,
      includeReasons: true,
    },
    enabled: true,
  };
}

function parseAgentSessionV3PilotExplicitDebugCorpusExporterArgs(
  args: readonly string[],
): RunAgentSessionV3PilotExplicitDebugCorpusExporterOptions {
  let includeJsonText = false;
  let maxShadowDebugSamples: number | undefined;
  let outPath: string | null = null;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--out') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing corpus output path after --out.');
      }
      outPath = nextArg;
      index += 1;
    } else if (arg === '--max-shadow') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing sample count after --max-shadow.');
      }
      maxShadowDebugSamples = Number(nextArg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return {
    includeJsonText,
    maxShadowDebugSamples,
    outPath,
    prettyJson,
  };
}

async function runAgentSessionV3PilotExplicitDebugScenarioResults(
  settings: PetConfig['settings'],
): Promise<AgentSessionV3PilotExplicitDebugScenarioResult[]> {
  const finalResult = await runAgentProductionSession({
    modelCaller: async () => JSON.stringify({
      action: 'final_answer',
      message: 'hello from explicit debug scenario',
      reason: 'The requested answer is known.',
    }),
    settings,
    sourceText: '/agent say hello',
    userGoal: 'say hello',
    v3PilotShadow: createAgentSessionV3PilotExplicitDebugShadowOptions(),
  });

  let toolModelCalls = 0;
  const toolModelCaller: AgentSessionV2ModelCaller = async () => {
    toolModelCalls += 1;

    if (toolModelCalls === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          includeActiveWindow: true,
          query: 'current window',
        },
        reason: 'Need current window evidence.',
        tool: 'observe_windows_and_apps',
      });
    }

    return JSON.stringify({
      action: 'final_answer',
      message: 'active window observed for explicit debug scenario',
      reason: 'The observation is enough.',
      understanding: {
        completedGoals: ['read active window'],
        remainingGoals: [],
        successCriteria: 'active window evidence was observed',
        userNeed: 'what is the current active window',
        verificationEvidence: ['Active window observed.'],
        verificationGaps: [],
        verificationStatus: 'satisfied',
      },
    });
  };

  const toolResult = await runAgentProductionSession({
    modelCaller: toolModelCaller,
    settings,
    sourceText: '/agent what is the current active window',
    toolExecutor: async () => ({
      ok: true,
      responseText: 'Active window result',
      verification: 'Active window observed.',
    }),
    userGoal: 'what is the current active window',
    v3PilotShadow: createAgentSessionV3PilotExplicitDebugShadowOptions(),
  });

  const approvalResult = await runAgentProductionSession({
    modelCaller: async () => JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'click',
        button: 'left',
        x: 120,
        y: 240,
      },
      reason: 'Clicking the requested target changes the desktop state.',
      tool: 'execute_desktop_input',
    }),
    settings,
    sourceText: '/agent click the requested target',
    toolExecutor: async () => {
      throw new Error('approval-required tool should not execute in this diagnostic exporter');
    },
    userGoal: 'click the requested target',
    v3PilotShadow: createAgentSessionV3PilotExplicitDebugShadowOptions(),
  });

  const needsUserResult = await runAgentProductionSession({
    modelCaller: async () => JSON.stringify({
      action: 'ask_user',
      message: 'Need one detail before continuing.',
      reason: 'The requested target is ambiguous.',
    }),
    settings,
    sourceText: '/agent do the ambiguous diagnostic task',
    userGoal: 'do the ambiguous diagnostic task',
    v3PilotShadow: createAgentSessionV3PilotExplicitDebugShadowOptions(),
  });

  const modelFailedResult = await runAgentProductionSession({
    modelCaller: async () => {
      throw new Error('simulated explicit debug model outage');
    },
    settings,
    sourceText: '/agent explicit debug model failed path',
    userGoal: 'explicit debug model failed path',
    v3PilotShadow: createAgentSessionV3PilotExplicitDebugShadowOptions(),
  });

  const budgetResult = await runAgentProductionSession({
    maxToolCalls: 0,
    modelCaller: async () => JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'get_display_info',
      },
      reason: 'Need one observation.',
      tool: 'execute_desktop_observation',
    }),
    settings,
    sourceText: '/agent explicit debug budget limited observation',
    toolExecutor: async () => {
      throw new Error('tool must not execute after tool budget is exhausted');
    },
    userGoal: 'explicit debug budget limited observation',
    v3PilotShadow: createAgentSessionV3PilotExplicitDebugShadowOptions(),
  });

  return [
    {
      label: 'final-completed',
      result: finalResult,
    },
    {
      label: 'readonly-tool-completed',
      result: toolResult,
    },
    {
      label: 'approval-required',
      result: approvalResult,
    },
    {
      label: 'needs-user',
      result: needsUserResult,
    },
    {
      label: 'model-failed',
      result: modelFailedResult,
    },
    {
      label: 'budget-exceeded',
      result: budgetResult,
    },
  ];
}

export async function runAgentSessionV3PilotExplicitDebugCorpusExporter(
  options: RunAgentSessionV3PilotExplicitDebugCorpusExporterOptions = {},
): Promise<AgentSessionV3PilotExplicitDebugCorpusExporterResult> {
  const settings = options.settings ?? ({} as PetConfig['settings']);
  const scenarioResults = await runAgentSessionV3PilotExplicitDebugScenarioResults(settings);
  const diagnosticRun = await runAgentSessionV3PilotDiagnosticSampleRunner({
    agreementReport: {
      collect: () => createAgentSessionV3PilotShadowAgreementReportExport(
        createAgentSessionV3PilotShadowAgreementReportFromResults(scenarioResults.map((entry) => ({
          label: entry.label,
          result: entry.result,
        }))),
        {
          includeSamples: true,
          maxSamples: scenarioResults.length,
        },
      ),
    },
    corpusOptions: {
      maxShadowDebugSamples: options.maxShadowDebugSamples,
    },
    label: 'explicit-debug-v2-scenarios',
    shadowDebugSamples: scenarioResults.map((entry) => ({
      collect: () => (entry.result.debug?.v3PilotShadow
        ? {
          label: entry.label,
          shadow: createAgentSessionV3PilotShadowDebugExport(entry.result.debug.v3PilotShadow),
        }
        : null),
      label: entry.label,
    })),
  });
  const outputJsonText = options.includeJsonText || options.outPath
    ? stringifyAgentSessionV3PilotDebugSampleCorpusExport(diagnosticRun.collection.corpus, {
      pretty: options.prettyJson,
    })
    : null;

  if (options.outPath && outputJsonText) {
    await writeFile(options.outPath, outputJsonText, 'utf8');
  }

  return {
    corpusPath: options.outPath ?? null,
    diagnosticRun,
    jsonText: options.includeJsonText ? outputJsonText : null,
    kind: 'agent-session-v3-pilot-explicit-debug-corpus-exporter',
    scenarioCount: scenarioResults.length,
    summaryText: diagnosticRun.summaryText,
    version: 1,
  };
}

async function runAgentSessionV3PilotExplicitDebugCorpusExporterCli() {
  const options = parseAgentSessionV3PilotExplicitDebugCorpusExporterArgs(process.argv.slice(2));
  const exported = await runAgentSessionV3PilotExplicitDebugCorpusExporter(options);
  console.log(exported.summaryText);
  if (exported.corpusPath) {
    console.log(`corpusPath=${exported.corpusPath}`);
  }
  if (exported.jsonText) {
    console.log(exported.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotExplicitDebugCorpusExporterCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
