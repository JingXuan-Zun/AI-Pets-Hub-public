import { useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { Brain, FileText, ImageIcon, Plug, Settings2, Trash2, Wrench } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import {
  DEFAULT_MODEL_CAPABILITIES,
  createDefaultModelRequestParams,
  normalizeModelRequestParams,
  normalizeOpenAICompatibleUrl,
  resolveModelRequestParams,
} from '../../modelProviderSettings';
import { type ModelCapabilities, type ModelRequestParam, type PetConfig } from '../../types';
import { SettingsModelRequestParamEditor } from './SettingsModelRequestParamEditor';

type CustomApiDraft = {
  modelName: string;
  apiUrl: string;
  apiKey: string;
};

type ModelTestStatusKind = 'info' | 'success' | 'error';

interface SettingsModelProviderToolsProps {
  customApiDraft: CustomApiDraft;
  noDragRegionStyle?: CSSProperties;
  settings: PetConfig['settings'];
  onApplySettings: (updates: Partial<PetConfig['settings']>) => void;
  onSetCustomApiDraft: Dispatch<SetStateAction<CustomApiDraft>>;
}

const CAPABILITY_ITEMS: Array<{
  icon: typeof FileText;
  key: keyof ModelCapabilities;
  label: string;
}> = [
  { icon: FileText, key: 'text', label: '文本' },
  { icon: ImageIcon, key: 'image', label: '图像' },
  { icon: Wrench, key: 'tools', label: '工具' },
  { icon: Brain, key: 'reasoning', label: '思考' },
];

function iconButtonClassName(isDanger = false) {
  return [
    'h-7 w-7 rounded-full border border-border/70 bg-background/60',
    isDanger
      ? 'text-destructive hover:bg-destructive/10'
      : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
  ].join(' ');
}

function modelTestStatusClassName(kind: ModelTestStatusKind) {
  const toneClassName = {
    info: 'border-border bg-secondary/40 text-muted-foreground',
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
  } satisfies Record<ModelTestStatusKind, string>;

  return [
    'max-w-[360px] rounded-sm border px-3 py-2 text-2xs leading-4',
    toneClassName[kind],
  ].join(' ');
}

function formatCapabilitySummary(capabilities: ModelCapabilities) {
  return CAPABILITY_ITEMS
    .filter((item) => capabilities[item.key])
    .map((item) => item.label)
    .join(' / ') || '未标记';
}

function ModelCapabilityToggle({
  capabilities,
  onChange,
}: {
  capabilities: ModelCapabilities;
  onChange: (capabilities: ModelCapabilities) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CAPABILITY_ITEMS.map((item) => {
        const Icon = item.icon;
        const checked = capabilities[item.key];

        return (
          <label
            key={item.key}
            className={[
              'flex cursor-pointer items-center justify-center gap-2 rounded-sm border px-3 py-2 text-xs transition-colors',
              checked
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-background/50 text-muted-foreground hover:bg-secondary/40',
            ].join(' ')}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={(event) => onChange({
                ...capabilities,
                [item.key]: event.target.checked,
              })}
            />
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </label>
        );
      })}
    </div>
  );
}

export function SettingsModelProviderTools({
  customApiDraft,
  noDragRegionStyle,
  settings,
  onApplySettings,
  onSetCustomApiDraft,
}: SettingsModelProviderToolsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [testStatusKind, setTestStatusKind] = useState<ModelTestStatusKind>('info');
  const capabilities = settings.customModelCapabilities ?? DEFAULT_MODEL_CAPABILITIES;
  const requestParams = normalizeModelRequestParams(settings.customModelRequestParams);

  const applyRequestParams = (params: ModelRequestParam[]) => onApplySettings({
    customModelRequestParams: normalizeModelRequestParams(params),
  });

  const updateTestStatus = (message: string, kind: ModelTestStatusKind) => {
    setTestStatus(message);
    setTestStatusKind(kind);
  };

  const testConnection = async () => {
    if (isTestingConnection) {
      return;
    }

    if (settings.llmProvider === 'gemini') {
      updateTestStatus(
        settings.geminiApiKey.trim()
          ? 'Gemini API Key 已填写，将在首次请求时验证。'
          : '请先填写 Gemini API Key。',
        settings.geminiApiKey.trim() ? 'info' : 'error',
      );
      return;
    }

    const apiUrl = customApiDraft.apiUrl.trim() || settings.customApiUrl.trim();
    const modelName = customApiDraft.modelName.trim() || settings.customModelName.trim();
    if (!apiUrl || !modelName) {
      updateTestStatus('请先填写接口地址和模型 ID。', 'error');
      return;
    }

    setIsTestingConnection(true);
    updateTestStatus('正在测试连接...', 'info');
    try {
      const params = resolveModelRequestParams(settings);
      const apiKey = customApiDraft.apiKey.trim() || settings.customApiKey.trim();
      const response = await fetch(normalizeOpenAICompatibleUrl(apiUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          ...params,
          model: modelName,
          messages: [{ role: 'user', content: 'Reply PONG only.' }],
          stream: false,
        }),
      });

      updateTestStatus(
        response.ok
          ? '连接成功。'
          : `连接失败：${response.status} ${response.statusText}`,
        response.ok ? 'success' : 'error',
      );
    } catch (error) {
      updateTestStatus(error instanceof Error ? error.message : '连接测试失败。', 'error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const resetModelSettings = () => {
    const confirmed = window.confirm(settings.llmProvider === 'openai'
      ? '确定清空当前自定义模型配置和高级参数吗？'
      : '确定清空当前 Gemini API Key 并重置高级参数吗？');
    if (!confirmed) {
      return;
    }

    onApplySettings({
      ...(settings.llmProvider === 'openai'
        ? { customApiKey: '', customApiUrl: '', customModelName: '' }
        : { geminiApiKey: '' }),
      customModelCapabilities: { ...DEFAULT_MODEL_CAPABILITIES },
      customModelRequestParams: createDefaultModelRequestParams(),
    });

    if (settings.llmProvider === 'openai') {
      onSetCustomApiDraft({ apiKey: '', apiUrl: '', modelName: '' });
    }
    setTestStatus('');
  };

  return (
    <div className="flex min-w-0 flex-col items-end gap-1" style={noDragRegionStyle}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="hidden rounded-full border border-border/70 bg-background/40 px-2 py-1 text-2xs text-muted-foreground sm:inline">
          {formatCapabilitySummary(capabilities)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void testConnection()}
          disabled={isTestingConnection}
          className={iconButtonClassName()}
          title="测试连接"
        >
          <Plug className={isTestingConnection ? 'h-3.5 w-3.5 animate-pulse' : 'h-3.5 w-3.5'} />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAdvancedOpen(true)} className={iconButtonClassName()} title="高级配置">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={resetModelSettings} className={iconButtonClassName(true)} title="重置模型配置">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {testStatus && (
        <div aria-live="polite" className={modelTestStatusClassName(testStatusKind)}>
          {testStatus}
        </div>
      )}

      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>模型高级配置</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {testStatus && (
              <div className={modelTestStatusClassName(testStatusKind)}>
                {testStatus}
              </div>
            )}

            <section className="space-y-2">
              <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                模型能力
              </Label>
              <ModelCapabilityToggle
                capabilities={capabilities}
                onChange={(nextCapabilities) => onApplySettings({ customModelCapabilities: nextCapabilities })}
              />
              <p className="text-2xs leading-4 text-muted-foreground">
                能力标记用于控制后续功能显示；是否真正支持仍以接口返回为准。
              </p>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                  自定义请求参数
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyRequestParams(createDefaultModelRequestParams())}
                  className="h-7 rounded-full px-3 text-2xs"
                >
                  恢复预设
                </Button>
              </div>
              <SettingsModelRequestParamEditor params={requestParams} onChange={applyRequestParams} />
              <p className="text-2xs leading-4 text-muted-foreground">
                已保护 model/messages/stream，避免自定义参数覆盖聊天核心字段。
              </p>
            </section>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAdvancedOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => setAdvancedOpen(false)}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
