import {
  resolve3DModelDependencyUrl,
  resolve3DModelLoaderUrl,
} from '../../model3dFormatSupport';

type Live2DDisplayInfoSettings = {
  json?: {
    FileReferences?: {
      DisplayInfo?: string;
    };
  };
  resolveURL?: (path: string) => string;
};

type Live2DDisplayInfoModel = {
  internalModel?: {
    settings?: Live2DDisplayInfoSettings;
  };
};

export function resolveLive2DDisplayInfoParameterIds(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const parameters = (value as { Parameters?: unknown }).Parameters;
  if (!Array.isArray(parameters)) {
    return null;
  }

  const parameterIds = new Set(parameters.flatMap((parameter) => {
    if (!parameter || typeof parameter !== 'object' || Array.isArray(parameter)) {
      return [];
    }

    const id = (parameter as { Id?: unknown }).Id;
    return typeof id === 'string' && id.trim() ? [id.trim()] : [];
  }));
  return parameterIds.size > 0 ? parameterIds : null;
}

export async function loadLive2DDeclaredParameterIds(
  model: Live2DDisplayInfoModel,
): Promise<ReadonlySet<string> | null> {
  const settings = model.internalModel?.settings;
  const displayInfoPath = settings?.json?.FileReferences?.DisplayInfo?.trim();
  if (!displayInfoPath || typeof settings?.resolveURL !== 'function') {
    return null;
  }

  try {
    const response = await fetch(settings.resolveURL(displayInfoPath));
    if (!response.ok) {
      return null;
    }

    return resolveLive2DDisplayInfoParameterIds(await response.json());
  } catch {
    return null;
  }
}

export async function loadLive2DDeclaredParameterIdsFromModelUrl(
  modelUrl: string,
): Promise<ReadonlySet<string> | null> {
  const runtimeUrl = resolve3DModelLoaderUrl(modelUrl);
  if (!runtimeUrl.trim()) {
    return null;
  }

  try {
    const modelResponse = await fetch(runtimeUrl);
    if (!modelResponse.ok) {
      return null;
    }
    const modelJson = await modelResponse.json() as {
      FileReferences?: { DisplayInfo?: unknown };
    };
    const displayInfoPath = modelJson.FileReferences?.DisplayInfo;
    if (typeof displayInfoPath !== 'string' || !displayInfoPath.trim()) {
      return null;
    }

    const displayInfoUrl = resolve3DModelDependencyUrl(displayInfoPath.trim(), runtimeUrl);
    const displayInfoResponse = await fetch(displayInfoUrl);
    if (!displayInfoResponse.ok) {
      return null;
    }
    return resolveLive2DDisplayInfoParameterIds(await displayInfoResponse.json());
  } catch {
    return null;
  }
}
