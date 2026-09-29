import {
  type ModelCapabilities,
  type ModelRequestParam,
  type ModelRequestParamValueType,
  type PetConfig,
} from './types';

export const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  text: true,
  image: false,
  tools: false,
  reasoning: false,
};

const DEFAULT_MODEL_REQUEST_PARAMS: ModelRequestParam[] = [
  { id: 'preset-temperature', key: 'temperature', value: '1', valueType: 'number' },
  { id: 'preset-top-p', key: 'top_p', value: '1', valueType: 'number' },
  { id: 'preset-max-tokens', key: 'max_tokens', value: '8192', valueType: 'number' },
];

const RESERVED_REQUEST_PARAM_KEYS = new Set([
  'messages',
  'model',
  'stream',
]);

const REQUEST_PARAM_VALUE_TYPES = new Set<ModelRequestParamValueType>([
  'string',
  'number',
  'boolean',
  'json',
]);

export function createDefaultModelRequestParams() {
  return DEFAULT_MODEL_REQUEST_PARAMS.map((param) => ({ ...param }));
}

export function normalizeModelCapabilities(value: unknown): ModelCapabilities {
  const rawValue = value && typeof value === 'object'
    ? value as Partial<Record<keyof ModelCapabilities, unknown>>
    : {};

  return {
    text: typeof rawValue.text === 'boolean' ? rawValue.text : DEFAULT_MODEL_CAPABILITIES.text,
    image: typeof rawValue.image === 'boolean' ? rawValue.image : DEFAULT_MODEL_CAPABILITIES.image,
    tools: typeof rawValue.tools === 'boolean' ? rawValue.tools : DEFAULT_MODEL_CAPABILITIES.tools,
    reasoning: typeof rawValue.reasoning === 'boolean' ? rawValue.reasoning : DEFAULT_MODEL_CAPABILITIES.reasoning,
  };
}

export function isReservedModelRequestParamKey(key: string) {
  return RESERVED_REQUEST_PARAM_KEYS.has(key.trim().toLowerCase());
}

function normalizeModelRequestParamValueType(value: unknown): ModelRequestParamValueType {
  return REQUEST_PARAM_VALUE_TYPES.has(value as ModelRequestParamValueType)
    ? value as ModelRequestParamValueType
    : 'string';
}

export function normalizeModelRequestParams(value: unknown): ModelRequestParam[] {
  if (!Array.isArray(value)) {
    return createDefaultModelRequestParams();
  }

  const normalizedParams = value
    .map((item, index): ModelRequestParam | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const key = typeof record.key === 'string' ? record.key.trim() : '';
      if (!key || isReservedModelRequestParamKey(key)) {
        return null;
      }

      return {
        id: typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : `param-${index}-${key}`,
        key,
        value: typeof record.value === 'string' ? record.value : String(record.value ?? ''),
        valueType: normalizeModelRequestParamValueType(record.valueType),
      };
    })
    .filter((item): item is ModelRequestParam => item !== null);

  return normalizedParams;
}

function parseBooleanParam(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return null;
}

function parseModelRequestParamValue(param: ModelRequestParam) {
  if (param.valueType === 'number') {
    const numberValue = Number(param.value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  if (param.valueType === 'boolean') {
    return parseBooleanParam(param.value);
  }

  if (param.valueType === 'json') {
    return JSON.parse(param.value);
  }

  return param.value;
}

export function parseModelRequestParams(params: ModelRequestParam[]) {
  const parsedParams: Record<string, unknown> = {};
  const errors: string[] = [];

  params.forEach((param) => {
    const key = param.key.trim();
    if (!key || isReservedModelRequestParamKey(key)) {
      return;
    }

    try {
      const value = parseModelRequestParamValue(param);
      if (typeof value === 'undefined' || value === null) {
        errors.push(`${key} 的值类型不正确。`);
        return;
      }

      parsedParams[key] = value;
    } catch {
      errors.push(`${key} 的 JSON 内容无法解析。`);
    }
  });

  return { errors, params: parsedParams };
}

export function normalizeOpenAICompatibleUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(/\/+$/, '');

    if (/\/chat\/completions$/i.test(normalizedPath)) {
      return url.toString();
    }

    if (/\/responses$/i.test(normalizedPath)) {
      url.pathname = `${normalizedPath.replace(/\/responses$/i, '')}/chat/completions`;
      return url.toString();
    }

    if (/\/v\d+$/i.test(normalizedPath)) {
      url.pathname = `${normalizedPath}/chat/completions`;
      return url.toString();
    }

    if (normalizedPath === '' || normalizedPath === '/') {
      url.pathname = '/v1/chat/completions';
      return url.toString();
    }

    url.pathname = `${normalizedPath}/chat/completions`;
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function normalizeOpenAICompatibleModelsUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(/\/+$/, '');

    if (/\/chat\/completions$/i.test(normalizedPath)) {
      url.pathname = `${normalizedPath.replace(/\/chat\/completions$/i, '')}/models`;
      return url.toString();
    }

    if (/\/responses$/i.test(normalizedPath)) {
      url.pathname = `${normalizedPath.replace(/\/responses$/i, '')}/models`;
      return url.toString();
    }

    if (/\/models$/i.test(normalizedPath)) {
      url.pathname = normalizedPath;
      return url.toString();
    }

    url.pathname = `${normalizedPath || '/v1'}/models`;
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function parseOpenAICompatibleModelIds(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }

  return Array.from(new Set(
    data
      .map((item) => (
        item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
          ? (item as { id: string }).id.trim()
          : ''
      ))
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function mapGeminiRequestParamKey(key: string) {
  if (key === 'max_tokens') {
    return 'maxOutputTokens';
  }

  if (key === 'top_p') {
    return 'topP';
  }

  if (key === 'top_k') {
    return 'topK';
  }

  return key;
}

export function resolveModelRequestParamsFromList(params: ModelRequestParam[]) {
  const normalizedParams = normalizeModelRequestParams(params);
  const parsedResult = parseModelRequestParams(normalizedParams);

  if (parsedResult.errors.length > 0) {
    throw new Error(`模型请求参数配置有误：${parsedResult.errors.join(' ')}`);
  }

  return parsedResult.params;
}

export function resolveModelRequestParams(settings: PetConfig['settings']) {
  return resolveModelRequestParamsFromList(settings.customModelRequestParams);
}

export function applyGeminiModelRequestParamsFromList(
  config: Record<string, unknown>,
  params: ModelRequestParam[],
) {
  const parsedParams = resolveModelRequestParamsFromList(params);

  Object.entries(parsedParams).forEach(([key, value]) => {
    config[mapGeminiRequestParamKey(key)] = value;
  });

  return config;
}

export function applyGeminiModelRequestParams(
  config: Record<string, unknown>,
  settings: PetConfig['settings'],
) {
  return applyGeminiModelRequestParamsFromList(config, settings.customModelRequestParams);
}
