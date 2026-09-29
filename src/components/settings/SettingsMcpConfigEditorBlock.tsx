import { SettingsMcpConfigPreflightPanel } from './SettingsMcpConfigPreflightPanel';
import { SettingsMcpExternalServerCandidateReviewPanel } from './SettingsMcpExternalServerCandidateReviewPanel';
import { SettingsMcpRealServerConfigGuidePanel } from './SettingsMcpRealServerConfigGuidePanel';
import { SettingsMcpSavedConfigReadinessReviewPanel } from './SettingsMcpSavedConfigReadinessReviewPanel';
import { SettingsMcpServerForm } from './SettingsMcpServerForm';
import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';

interface SettingsMcpConfigEditorBlockProps {
  configText: string;
  draft: SettingsMcpServerDraft;
  onConfigTextChange: (text: string) => void;
  onDraftChange: (draft: SettingsMcpServerDraft) => void;
  onFeedback: (message: string) => void;
  onTestServer: (serverId: string) => void;
}

export function SettingsMcpConfigEditorBlock({
  configText,
  draft,
  onConfigTextChange,
  onDraftChange,
  onFeedback,
  onTestServer,
}: SettingsMcpConfigEditorBlockProps) {
  return (
    <>
      <textarea
        className="min-h-[168px] w-full resize-y rounded-sm border border-border bg-background/60 p-3 font-mono text-2xs leading-5 outline-none focus:border-primary"
        spellCheck={false}
        value={configText}
        onChange={(event) => onConfigTextChange(event.target.value)}
      />
      <div className="mt-3">
        <SettingsMcpConfigPreflightPanel configText={configText} onFeedback={onFeedback} />
      </div>
      <div className="mt-3">
        <SettingsMcpExternalServerCandidateReviewPanel configText={configText} />
      </div>
      <div className="mt-3">
        <SettingsMcpSavedConfigReadinessReviewPanel configText={configText} draft={draft} />
      </div>
      <div className="mt-3">
        <SettingsMcpRealServerConfigGuidePanel configText={configText} draft={draft} />
      </div>
      <div className="mt-3">
        <SettingsMcpServerForm
          configText={configText}
          draft={draft}
          onConfigTextChange={onConfigTextChange}
          onDraftChange={onDraftChange}
          onFeedback={onFeedback}
          onTestServer={onTestServer}
        />
      </div>
    </>
  );
}
