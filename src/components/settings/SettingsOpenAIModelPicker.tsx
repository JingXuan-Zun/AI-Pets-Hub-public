import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  normalizeOpenAICompatibleModelsUrl,
  parseOpenAICompatibleModelIds,
} from '../../modelProviderSettings';

interface SettingsOpenAIModelPickerProps {
  modelName: string;
  apiUrl: string;
  apiKey: string;
  inputClassName: string;
  noDragRegionStyle?: CSSProperties;
  onModelNameChange: (modelName: string) => void;
}

type DiscoveryStatus = 'idle' | 'loading' | 'success' | 'error';

export function SettingsOpenAIModelPicker({
  modelName,
  apiUrl,
  apiKey,
  inputClassName,
  noDragRegionStyle,
  onModelNameChange,
}: SettingsOpenAIModelPickerProps) {
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>('idle');
  const [message, setMessage] = useState('');
  const discoveryRequestRef = useRef(0);

  useEffect(() => {
    discoveryRequestRef.current += 1;
    setModels([]);
    setStatus('idle');
    setMessage('');
  }, [apiKey, apiUrl]);

  const discoverModels = async () => {
    const modelsUrl = normalizeOpenAICompatibleModelsUrl(apiUrl);
    if (!modelsUrl) {
      setStatus('error');
      setMessage('请先填写 Base URL。');
      return;
    }

    const requestId = discoveryRequestRef.current + 1;
    discoveryRequestRef.current = requestId;
    setStatus('loading');
    setMessage('正在读取模型列表...');
    try {
      const response = await fetch(modelsUrl, {
        headers: {
          Accept: 'application/json',
          ...(apiKey.trim()
            ? { Authorization: `Bearer ${apiKey.trim()}` }
            : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`读取失败：${response.status} ${response.statusText}`);
      }

      const discoveredModels = parseOpenAICompatibleModelIds(await response.json());
      if (requestId !== discoveryRequestRef.current) {
        return;
      }
      if (discoveredModels.length === 0) {
        throw new Error('接口没有返回可用模型。');
      }

      setModels(discoveredModels);
      setStatus('success');
      setMessage(`已发现 ${discoveredModels.length} 个模型`);
      if (!discoveredModels.includes(modelName.trim())) {
        onModelNameChange(discoveredModels[0]);
      }
    } catch (error) {
      if (requestId !== discoveryRequestRef.current) {
        return;
      }
      setModels([]);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '读取模型列表失败。');
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      {models.length > 0 ? (
        <select
          className={inputClassName}
          style={noDragRegionStyle}
          value={models.includes(modelName) ? modelName : ''}
          onChange={(event) => onModelNameChange(event.target.value)}
        >
          <option value="">选择模型</option>
          {models.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      ) : (
        <Input
          className={inputClassName}
          style={noDragRegionStyle}
          value={modelName}
          onChange={(event) => onModelNameChange(event.target.value)}
          placeholder="模型 ID"
        />
      )}
      <div className="order-first flex min-h-9 items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void discoverModels()}
          disabled={status === 'loading'}
          className="h-7 rounded-sm px-3 text-2xs"
        >
          <RefreshCw className={status === 'loading' ? 'mr-1.5 h-3 w-3 animate-spin' : 'mr-1.5 h-3 w-3'} />
          读取模型
        </Button>
        {message && (
          <span className={`order-first mr-auto text-2xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
