import { useState } from 'react';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  callNeuralPersonaSemanticProvider,
  createNeuralPersonaSemanticDocuments,
  createReadonlyNeuralPersonaGraphStore,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';
import {
  createNeuralPersonaConfiguredModelDataPolicy,
  createNeuralPersonaConfiguredModelProviders,
  resolveNeuralPersonaConfiguredModelIssue,
} from '../../services/neuralPersonaConfiguredModelProvider';
import type { PetConfig } from '../../types';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

interface ProviderPanelProps {
  onUpdate: (updates: Partial<PetConfig['settings']>) => void;
  record: NeuralPersonaPersistedRecord;
  settings: PetConfig['settings'];
}

function ProviderSwitches(props: ProviderPanelProps) {
  const { settings } = props;
  return (
    <div className="grid gap-2 text-2xs md:grid-cols-2">
      <SettingsToggleSwitch checked={settings.neuralPersonaProviderDataEgressConsent} className="justify-between" label="允许向当前模型发送最小化认知摘要" onChange={(checked) => props.onUpdate({ neuralPersonaProviderDataEgressConsent: checked })} />
      <SettingsToggleSwitch checked={settings.neuralPersonaPrivateProviderDataConsent} disabled={!settings.neuralPersonaProviderDataEgressConsent} className="justify-between" label="额外允许私人节点摘要出站" onChange={(checked) => props.onUpdate({ neuralPersonaPrivateProviderDataConsent: checked })} />
      <SettingsToggleSwitch checked={settings.neuralPersonaSemanticRetrievalEnabled} className="justify-between" label="启用模型语义检索" onChange={(checked) => props.onUpdate({ neuralPersonaSemanticRetrievalEnabled: checked })} />
      <SettingsToggleSwitch checked={settings.neuralPersonaModelTagSuggestionsEnabled} className="justify-between" label="启用模型标签建议" onChange={(checked) => props.onUpdate({ neuralPersonaModelTagSuggestionsEnabled: checked })} />
      <label className="grid gap-1 text-muted-foreground md:col-span-2">
        <span>Provider 超时（1000～30000 ms）</span>
        <input type="number" min={1_000} max={30_000} step={500} value={settings.neuralPersonaProviderTimeoutMs} onChange={(event) => props.onUpdate({ neuralPersonaProviderTimeoutMs: Number(event.target.value) })} className="h-8 rounded-sm border border-border bg-background px-2" />
      </label>
    </div>
  );
}

function useSemanticTest(props: ProviderPanelProps) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!props.settings.neuralPersonaSemanticRetrievalEnabled) {
      setMessage('请先启用模型语义检索。'); return;
    }
    const store = createReadonlyNeuralPersonaGraphStore(
      props.record.graph, DEFAULT_NEURAL_PERSONA_CONFIG,
    );
    if (!store.valid) { setMessage('当前图谱校验失败。'); return; }
    const policy = createNeuralPersonaConfiguredModelDataPolicy(
      props.settings.neuralPersonaPrivateProviderDataConsent,
    );
    const documents = createNeuralPersonaSemanticDocuments(store.store, {
      groupIds: [], includePrivate: props.settings.neuralPersonaPrivateProviderDataConsent,
      now: Date.now(), query, requestId: `provider-test:${Date.now()}`,
      roleId: props.record.roleId, sessionId: 'settings-preview', subgroupIds: [], turnId: 'test',
    }, policy);
    const provider = createNeuralPersonaConfiguredModelProviders({
      dataEgressConsent: props.settings.neuralPersonaProviderDataEgressConsent,
      settings: props.settings, timeoutMs: props.settings.neuralPersonaProviderTimeoutMs,
    }).semanticProvider;
    setBusy(true);
    try {
      const result = await callNeuralPersonaSemanticProvider(provider, {
        documents, maxResults: Math.min(6, Math.max(1, documents.length)),
        query, requestId: `provider-test:${Date.now()}`, roleId: props.record.roleId,
      });
      setMessage(result.status === 'ok'
        ? `语义结果：${result.matches.map((item) => `${item.nodeId} ${item.score.toFixed(2)}`).join('；') || '无匹配'}`
        : `已安全降级：${result.reason}`);
    } finally { setBusy(false); }
  };
  return { busy, message, query, run, setQuery };
}

function SemanticTest(props: ProviderPanelProps) {
  const test = useSemanticTest(props);
  return (
    <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
      <div className="flex gap-2">
        <input value={test.query} onChange={(event) => test.setQuery(event.target.value)} placeholder="输入测试语句" className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-2xs" />
        <button type="button" disabled={test.busy || !test.query.trim()} onClick={() => void test.run()} className="rounded-sm border border-primary px-3 text-2xs text-primary disabled:opacity-50">测试语义检索</button>
      </div>
      {test.message ? <div className="text-3xs text-muted-foreground">{test.message}</div> : null}
    </div>
  );
}

export function NeuralPersonaProviderPanel(props: ProviderPanelProps) {
  const issue = resolveNeuralPersonaConfiguredModelIssue(props.settings);
  return (
    <details className="rounded-sm border border-border bg-secondary/10 p-4">
      <summary className="cursor-pointer text-xs font-semibold">模型语义与智能标签（可选）</summary>
      <div className="mt-3 text-3xs text-muted-foreground">复用当前聊天模型配置。默认不发送任何神经人格数据；群组和子群组节点始终禁止出站。</div>
      {issue ? <div className="mt-2 text-3xs text-amber-500">Provider 未就绪：{issue}</div> : null}
      <div className="mt-3"><ProviderSwitches {...props} /></div>
      <SemanticTest {...props} />
    </details>
  );
}
