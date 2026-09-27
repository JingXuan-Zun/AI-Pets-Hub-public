import { useState } from 'react';
import { Boxes, Settings2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { createAgentSkillManifest } from '../../agent/agentSkillManifest';
import type { PetConfig } from '../../types';
import { SettingsAgentSkillDeveloperView } from './SettingsAgentSkillDeveloperView';
import { SettingsAgentSkillOverview } from './SettingsAgentSkillOverview';

interface SettingsAgentSkillManifestPanelProps {
  localConfig: PetConfig;
  showMcpProgress?: boolean;
}

export function SettingsAgentSkillManifestPanel({
  localConfig,
  showMcpProgress = true,
}: SettingsAgentSkillManifestPanelProps) {
  const manifest = createAgentSkillManifest();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState(manifest.entries[0]?.id ?? '');

  return (
    <div className="rounded-sm border border-border bg-secondary/15 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-foreground">能力扩展</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            查看桌宠已经具备或可以接入的能力。普通使用只需关注是否可用，开发与运行细节集中在高级设置中。
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-2xs text-primary">
            <Boxes className="h-3.5 w-3.5" />
            {manifest.summary.total} 项能力
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((current) => !current)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {advancedOpen ? '收起高级设置' : '高级设置'}
          </Button>
        </div>
      </div>

      <SettingsAgentSkillOverview manifest={manifest} />
      {advancedOpen ? (
        <SettingsAgentSkillDeveloperView
          localConfig={localConfig}
          manifest={manifest}
          selectedSkillId={selectedSkillId}
          showMcpProgress={showMcpProgress}
          onSelectSkillId={setSelectedSkillId}
        />
      ) : null}
    </div>
  );
}
