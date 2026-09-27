import { ClipboardList } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';
import {
  cloneMcpServerTemplateDraft,
  createMcpServerReadyDraftExamples,
  createMcpServerTemplates,
} from './settingsMcpServerTemplateUtils';

interface SettingsMcpServerTemplatePanelProps {
  onSelectTemplate: (draft: SettingsMcpServerDraft, message: string) => void;
}

const TEMPLATES = createMcpServerTemplates();
const READY_DRAFTS = createMcpServerReadyDraftExamples();

export function SettingsMcpServerTemplatePanel({
  onSelectTemplate,
}: SettingsMcpServerTemplatePanelProps) {
  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        Config templates
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {TEMPLATES.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="outline"
            className="h-auto min-h-14 justify-start rounded-sm px-3 py-2 text-left"
            onClick={() => onSelectTemplate(
              cloneMcpServerTemplateDraft(template),
              `Loaded ${template.title} MCP template. Replace placeholders before saving.`,
            )}
          >
            <div className="min-w-0">
              <div className="text-xs">{template.title}</div>
              <div className="mt-1 text-2xs leading-4 text-muted-foreground">
                {template.description}
              </div>
            </div>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        Ready draft examples
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {READY_DRAFTS.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="secondary"
            className="h-auto min-h-14 justify-start rounded-sm px-3 py-2 text-left"
            onClick={() => onSelectTemplate(
              cloneMcpServerTemplateDraft(template),
              `Loaded ${template.title} MCP draft. Save it, run readiness, then run soak before treating it as evidence.`,
            )}
          >
            <div className="min-w-0">
              <div className="text-xs">{template.title}</div>
              <div className="mt-1 text-2xs leading-4 text-muted-foreground">
                {template.description}
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
