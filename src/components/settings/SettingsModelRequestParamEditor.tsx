import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Slider } from '../../../components/ui/slider';
import {
  isReservedModelRequestParamKey,
  parseModelRequestParams,
} from '../../modelProviderSettings';
import {
  type ModelRequestParam,
  type ModelRequestParamValueType,
} from '../../types';

const VALUE_TYPE_OPTIONS: ModelRequestParamValueType[] = ['string', 'number', 'boolean', 'json'];
const PRESET_PARAM_KEYS = ['temperature', 'top_p', 'max_tokens'];

function requestParamInputClassName() {
  return 'h-9 rounded-sm border-border bg-background/70 text-xs focus-visible:ring-primary';
}

function createRequestParam(key = '', valueType: ModelRequestParamValueType = 'string'): ModelRequestParam {
  return {
    id: `param-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    key,
    value: '',
    valueType,
  };
}

function parseNumberValue(value: string, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function RequestParamValueEditor({
  param,
  onChange,
}: {
  param: ModelRequestParam;
  onChange: (param: ModelRequestParam) => void;
}) {
  if (param.valueType === 'boolean') {
    return (
      <select
        value={param.value === 'true' ? 'true' : 'false'}
        onChange={(event) => onChange({ ...param, value: event.target.value })}
        className="h-9 rounded-sm border border-border bg-background/70 px-2 text-xs outline-none focus:border-primary"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return (
    <Input
      className={requestParamInputClassName()}
      value={param.value}
      onChange={(event) => onChange({ ...param, value: event.target.value })}
      placeholder={param.valueType === 'json' ? '{"key":"value"}' : '参数值'}
    />
  );
}

function PresetParamRow({
  label,
  max,
  min,
  param,
  step,
  onChange,
  onRemove,
}: {
  label: string;
  max: number;
  min: number;
  param: ModelRequestParam;
  step: number;
  onChange: (param: ModelRequestParam) => void;
  onRemove: () => void;
}) {
  const value = parseNumberValue(param.value, min);

  return (
    <div className="grid gap-2 rounded-sm border border-border/70 bg-background/35 p-3 sm:grid-cols-[140px_1fr_120px_28px] sm:items-center">
      <div>
        <div className="text-xs font-semibold text-foreground">{label}</div>
        <div className="mt-1 text-2xs leading-4 text-muted-foreground">
          {param.key === 'temperature' ? '越高越随机。' : param.key === 'top_p' ? '控制采样概率质量。' : '生成最大令牌数。'}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(nextValue) => onChange({ ...param, value: String(nextValue[0] ?? value) })}
      />
      <Input
        className={requestParamInputClassName()}
        value={param.value}
        onChange={(event) => onChange({ ...param, value: event.target.value })}
      />
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} className="text-destructive hover:bg-destructive/10">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SettingsModelRequestParamEditor({
  params,
  onChange,
}: {
  params: ModelRequestParam[];
  onChange: (params: ModelRequestParam[]) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const [newValueType, setNewValueType] = useState<ModelRequestParamValueType>('string');
  const validation = useMemo(() => parseModelRequestParams(params), [params]);

  const updateParam = (id: string, nextParam: ModelRequestParam) => {
    onChange(params.map((param) => (param.id === id ? nextParam : param)));
  };
  const removeParam = (id: string) => onChange(params.filter((param) => param.id !== id));
  const findPreset = (key: string) => params.find((param) => param.key === key && param.valueType === 'number');

  const addParam = () => {
    const key = newKey.trim();
    if (!key || isReservedModelRequestParamKey(key) || params.some((param) => param.key === key)) {
      return;
    }

    onChange([...params, createRequestParam(key, newValueType)]);
    setNewKey('');
    setNewValueType('string');
  };

  return (
    <div className="space-y-3">
      {[
        { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.1 },
        { key: 'top_p', label: 'Top-p', min: 0, max: 1, step: 0.05 },
        { key: 'max_tokens', label: 'Max Tokens', min: 256, max: 32768, step: 256 },
      ].map((preset) => {
        const param = findPreset(preset.key);
        if (!param) {
          return null;
        }

        return (
          <PresetParamRow
            key={preset.key}
            label={preset.label}
            max={preset.max}
            min={preset.min}
            param={param}
            step={preset.step}
            onChange={(nextParam) => updateParam(param.id, nextParam)}
            onRemove={() => removeParam(param.id)}
          />
        );
      })}

      {params
        .filter((param) => !PRESET_PARAM_KEYS.includes(param.key))
        .map((param) => (
          <div key={param.id} className="grid gap-2 rounded-sm border border-border/70 bg-background/35 p-3 sm:grid-cols-[1fr_110px_1.4fr_28px] sm:items-center">
            <Input
              className={requestParamInputClassName()}
              value={param.key}
              onChange={(event) => updateParam(param.id, { ...param, key: event.target.value.trim() })}
              placeholder="参数名"
            />
            <select
              value={param.valueType}
              onChange={(event) => updateParam(param.id, {
                ...param,
                valueType: event.target.value as ModelRequestParamValueType,
              })}
              className="h-9 rounded-sm border border-border bg-background/70 px-2 text-xs outline-none focus:border-primary"
            >
              {VALUE_TYPE_OPTIONS.map((valueType) => (
                <option key={valueType} value={valueType}>{valueType}</option>
              ))}
            </select>
            <RequestParamValueEditor param={param} onChange={(nextParam) => updateParam(param.id, nextParam)} />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeParam(param.id)} className="text-destructive hover:bg-destructive/10">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

      <div className="grid gap-2 rounded-sm border border-dashed border-border bg-secondary/20 p-3 sm:grid-cols-[1fr_120px_90px]">
        <Input
          className={requestParamInputClassName()}
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
          placeholder="新键名"
        />
        <select
          value={newValueType}
          onChange={(event) => setNewValueType(event.target.value as ModelRequestParamValueType)}
          className="h-9 rounded-sm border border-border bg-background/70 px-2 text-xs outline-none focus:border-primary"
        >
          {VALUE_TYPE_OPTIONS.map((valueType) => (
            <option key={valueType} value={valueType}>{valueType}</option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={addParam} className="h-9 rounded-sm text-xs">
          + 添加
        </Button>
      </div>

      {validation.errors.length > 0 && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-2xs text-destructive">
          {validation.errors.join(' ')}
        </div>
      )}
    </div>
  );
}
