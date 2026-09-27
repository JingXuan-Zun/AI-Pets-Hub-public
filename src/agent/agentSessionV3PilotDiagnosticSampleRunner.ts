import {
  collectAgentSessionV3PilotDebugSampleCorpus,
  type AgentSessionV3PilotDebugSampleCollectionResult,
  type CollectAgentSessionV3PilotDebugSampleCorpusOptions,
} from './agentSessionV3PilotDebugSampleCollector';
import { stringifyAgentSessionV3PilotDebugSampleCorpusExport } from './agentSessionV3PilotDebugSampleCorpus';

export interface RunAgentSessionV3PilotDiagnosticSampleRunnerOptions
  extends CollectAgentSessionV3PilotDebugSampleCorpusOptions {
  includeJsonText?: boolean;
  label?: string | null;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotDiagnosticSampleRunnerResult {
  collection: AgentSessionV3PilotDebugSampleCollectionResult;
  issueCount: number;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-diagnostic-sample-run';
  label: string | null;
  status: AgentSessionV3PilotDebugSampleCollectionResult['status'];
  summaryText: string;
  version: 1;
}

export async function runAgentSessionV3PilotDiagnosticSampleRunner(
  options: RunAgentSessionV3PilotDiagnosticSampleRunnerOptions,
): Promise<AgentSessionV3PilotDiagnosticSampleRunnerResult> {
  const collection = await collectAgentSessionV3PilotDebugSampleCorpus({
    agreementReport: options.agreementReport,
    corpusOptions: options.corpusOptions,
    shadowDebugSamples: options.shadowDebugSamples,
  });
  const jsonText = options.includeJsonText
    ? stringifyAgentSessionV3PilotDebugSampleCorpusExport(collection.corpus, {
      pretty: options.prettyJson,
    })
    : null;

  return {
    collection,
    issueCount: collection.issues.length,
    jsonText,
    kind: 'agent-session-v3-pilot-diagnostic-sample-run',
    label: options.label ?? null,
    status: collection.status,
    summaryText: collection.corpus.summaryText,
    version: 1,
  };
}
