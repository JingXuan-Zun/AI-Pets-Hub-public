import { type PetConfig } from '../../types';
import { SettingsMcpSection } from './SettingsMcpSection';
import { SettingsSkillDirectory } from './SettingsSkillDirectory';

/** Platform capabilities deliberately use their own routes instead of the
 * generic system page, so MCP and Skill do not inherit unrelated settings. */
export function SettingsPlatformMcpTab() {
  return (
    <div className="m-0">
      <SettingsMcpSection />
    </div>
  );
}

export function SettingsPlatformSkillApiTab({ localConfig, currentPetId = 'primary' }: { localConfig: PetConfig; currentPetId?: string }) {
  return (
    <div className="m-0">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="Skills">
        <h2 className="mb-2 text-base font-bold">Skills</h2>
        <p className="mb-5 text-xs text-muted-foreground">导入和管理 Skill，为当前选中的桌宠启用所需能力。</p>
        <SettingsSkillDirectory currentPetId={currentPetId} />
      </section>
    </div>
  );
}
