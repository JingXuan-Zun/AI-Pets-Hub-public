import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import {
  applyMcpPolicyTextToConfigText,
  getMcpPolicyText,
} from './settingsMcpPolicyConfigUtils';

interface SettingsMcpPolicyEditorProps {
  configText: string;
  onConfigTextChange: (text: string) => void;
  onFeedback: (message: string) => void;
}

export function SettingsMcpPolicyEditor({
  configText,
  onConfigTextChange,
  onFeedback,
}: SettingsMcpPolicyEditorProps) {
  const [policyText, setPolicyText] = useState(() => getMcpPolicyText(configText));

  useEffect(() => {
    setPolicyText(getMcpPolicyText(configText));
  }, [configText]);

  const applyPolicy = () => {
    const result = applyMcpPolicyTextToConfigText(configText, policyText);
    if (result.error) {
      onFeedback(result.error);
      return;
    }

    onConfigTextChange(result.rawText);
    onFeedback('MCP policy JSON has been applied. Save config to make it active.');
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-2xs text-foreground">policies</div>
        <Button type="button" variant="outline" className="h-8 rounded-sm text-xs" onClick={applyPolicy}>
          <ShieldCheck className="h-3.5 w-3.5" />
          Apply
        </Button>
      </div>
      <textarea
        className="min-h-[96px] w-full resize-y rounded-sm border border-border bg-background/70 p-2 font-mono text-2xs leading-5 outline-none focus:border-primary"
        spellCheck={false}
        value={policyText}
        onChange={(event) => setPolicyText(event.target.value)}
      />
    </div>
  );
}
