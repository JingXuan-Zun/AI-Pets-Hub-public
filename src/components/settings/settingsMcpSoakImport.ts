import {
  createSettingsMcpSoakSummaryResult,
  type SettingsMcpSoakReport,
  type SettingsMcpSoakSummaryResult,
} from './settingsMcpSoakSummary';
import {
  isSettingsMcpSoakEvidenceEnvelope,
  parseSettingsMcpSoakEvidenceEnvelope,
} from './settingsMcpSoakEvidence';

export function parseSettingsMcpSoakReportText(
  text: string,
  inputPath: string,
): SettingsMcpSoakSummaryResult {
  const parsed = JSON.parse(text) as SettingsMcpSoakReport | unknown;
  if (isSettingsMcpSoakEvidenceEnvelope(parsed)) {
    return parseSettingsMcpSoakEvidenceEnvelope(parsed, inputPath);
  }

  const report = parsed as SettingsMcpSoakReport;
  if (report.kind !== 'mcp-real-server-soak-report') {
    throw new Error('Input is not an MCP real-server soak report or Settings soak evidence export.');
  }

  return createSettingsMcpSoakSummaryResult({
    inputPath,
    report,
  });
}
