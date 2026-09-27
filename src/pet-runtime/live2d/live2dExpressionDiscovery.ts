import { resolve3DModelDependencyUrl } from '../../model3dFormatSupport';
import { type PetModelMotionBinding, type PetModelMotionKey } from '../../types';

type Live2DModelJsonExpressionDefinition = {
  File?: unknown;
  Name?: unknown;
};

type Live2DModelJsonMotionDefinition = {
  File?: unknown;
};

type Live2DModelJson = {
  FileReferences?: {
    Expressions?: unknown;
    Motions?: unknown;
  };
};

export type Live2DExpressionAssetCandidate = {
  name: string;
  sourceUrl: string;
};

export type Live2DMotionAssetCandidate = {
  durationMs?: number;
  name: string;
  sourceUrl: string;
};

export type Live2DDirectoryEntryLike = {
  kind?: string;
  name?: string;
  path?: string;
};

const LIVE2D_EXPRESSION_MOTION_KEY_GUESS_RULES: Array<{ motionKey: PetModelMotionKey; patterns: RegExp[] }> = [
  { motionKey: 'happy', patterns: [/happy/iu, /smile/iu, /joy/iu, /shy/iu, /blush/iu, /开心/u, /笑/u, /害羞/u, /脸红/u] },
  { motionKey: 'sad', patterns: [/sad/iu, /cry/iu, /angry/iu, /nervous/iu, /panic/iu, /难过/u, /哭/u, /生气/u, /慌张/u, /紧张/u, /黑脸/u, /白眼/u] },
  { motionKey: 'sleeping', patterns: [/sleep/iu, /blink/iu, /wink/iu, /睡/u, /困/u, /眨眼/u, /闭眼/u] },
  { motionKey: 'eating', patterns: [/eat/iu, /food/iu, /吃/u, /咀嚼/u] },
];

const LIVE2D_MOTION_KEY_GUESS_RULES: Array<{ motionKey: PetModelMotionKey; patterns: RegExp[] }> = [
  { motionKey: 'sleeping', patterns: [/sleep/iu, /rest/iu, /doze/iu, /idle_sleep/iu] },
  { motionKey: 'walking', patterns: [/walk/iu, /stroll/iu, /locomotion/iu, /move/iu] },
  { motionKey: 'running', patterns: [/run/iu, /dash/iu, /sprint/iu] },
  { motionKey: 'swimming', patterns: [/swim/iu, /float/iu] },
  { motionKey: 'happy', patterns: [/happy/iu, /smile/iu, /joy/iu, /cheer/iu] },
  { motionKey: 'sad', patterns: [/sad/iu, /cry/iu, /down/iu, /upset/iu] },
  { motionKey: 'eating', patterns: [/eat/iu, /chew/iu, /food/iu, /mogu/iu] },
  { motionKey: 'idle', patterns: [/idle/iu, /stand/iu, /wait/iu, /default/iu] },
];

function stripLive2DExpressionExtension(value: string) {
  return value.replace(/\.exp3\.json$/iu, '').trim();
}

function stripLive2DMotionExtension(value: string) {
  return value.replace(/\.motion3\.json$/iu, '').trim();
}

function dedupeExpressionAssetCandidates(
  candidates: Live2DExpressionAssetCandidate[],
) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.name.trim()}|${candidate.sourceUrl.trim()}`;
    if (!candidate.name.trim() || !candidate.sourceUrl.trim() || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeMotionAssetCandidates(
  candidates: Live2DMotionAssetCandidate[],
) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.name.trim()}|${candidate.sourceUrl.trim()}`;
    if (!candidate.name.trim() || !candidate.sourceUrl.trim() || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function guessLive2DExpressionMotionKeyFromName(name: string) {
  for (const rule of LIVE2D_EXPRESSION_MOTION_KEY_GUESS_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(name))) {
      return rule.motionKey;
    }
  }

  return 'idle' satisfies PetModelMotionKey;
}

function guessLive2DMotionKeyFromName(name: string) {
  const normalizedName = name
    .trim()
    .replace(/\.[^.]+$/u, '')
    .toLowerCase();

  for (const rule of LIVE2D_MOTION_KEY_GUESS_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedName))) {
      return rule.motionKey;
    }
  }

  return 'idle' satisfies PetModelMotionKey;
}

export function resolveLive2DExpressionAssetsFromModelJsonText(
  modelJsonText: string,
  modelUrl: string,
) {
  let parsedModelJson: Live2DModelJson | null = null;
  try {
    parsedModelJson = JSON.parse(modelJsonText) as Live2DModelJson;
  } catch {
    return [] as Live2DExpressionAssetCandidate[];
  }

  const expressions = parsedModelJson?.FileReferences?.Expressions;
  if (!Array.isArray(expressions)) {
    return [] as Live2DExpressionAssetCandidate[];
  }

  return dedupeExpressionAssetCandidates(
    expressions
      .map((rawDefinition): Live2DExpressionAssetCandidate | null => {
        if (!rawDefinition || typeof rawDefinition !== 'object') {
          return null;
        }

        const definition = rawDefinition as Live2DModelJsonExpressionDefinition;
        const file = typeof definition.File === 'string' ? definition.File.trim() : '';
        if (!file) {
          return null;
        }

        const rawName = typeof definition.Name === 'string' ? definition.Name.trim() : '';
        const fallbackName = stripLive2DExpressionExtension(file.replace(/\\/gu, '/').split('/').pop() ?? '');
        const name = rawName || fallbackName;
        if (!name) {
          return null;
        }

        return {
          name,
          sourceUrl: resolve3DModelDependencyUrl(file, modelUrl),
        };
      })
      .filter((candidate): candidate is Live2DExpressionAssetCandidate => candidate !== null),
  );
}

export function resolveLive2DMotionAssetsFromModelJsonText(
  modelJsonText: string,
  modelUrl: string,
) {
  let parsedModelJson: Live2DModelJson | null = null;
  try {
    parsedModelJson = JSON.parse(modelJsonText) as Live2DModelJson;
  } catch {
    return [] as Live2DMotionAssetCandidate[];
  }

  const motions = parsedModelJson?.FileReferences?.Motions;
  if (!motions || typeof motions !== 'object' || Array.isArray(motions)) {
    return [] as Live2DMotionAssetCandidate[];
  }

  return dedupeMotionAssetCandidates(
    Object.entries(motions).flatMap(([groupName, rawDefinitions]) => {
      if (!Array.isArray(rawDefinitions)) {
        return [] as Live2DMotionAssetCandidate[];
      }

      return rawDefinitions
        .map((rawDefinition, index): Live2DMotionAssetCandidate | null => {
          if (!rawDefinition || typeof rawDefinition !== 'object') {
            return null;
          }

          const definition = rawDefinition as Live2DModelJsonMotionDefinition;
          const file = typeof definition.File === 'string' ? definition.File.trim() : '';
          if (!/\.motion3\.json$/iu.test(file)) {
            return null;
          }

          const fallbackName = stripLive2DMotionExtension(file.replace(/\\/gu, '/').split('/').pop() ?? '');
          const name = [groupName, fallbackName || `motion-${index + 1}`].filter(Boolean).join('-');
          return {
            name,
            sourceUrl: resolve3DModelDependencyUrl(file, modelUrl),
          };
        })
        .filter((candidate): candidate is Live2DMotionAssetCandidate => candidate !== null);
    }),
  );
}

export function resolveLive2DExpressionAssetsFromDirectoryEntries(
  entries: Live2DDirectoryEntryLike[],
  modelUrl: string,
) {
  return dedupeExpressionAssetCandidates(
    entries
      .filter((entry) => entry.kind === 'file')
      .map((entry): Live2DExpressionAssetCandidate | null => {
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!/\.exp3\.json$/iu.test(name)) {
          return null;
        }

        const sourcePath = typeof entry.path === 'string' && entry.path.trim()
          ? entry.path.trim()
          : name;
        return {
          name: stripLive2DExpressionExtension(name),
          sourceUrl: resolve3DModelDependencyUrl(sourcePath, modelUrl),
        };
      })
      .filter((candidate): candidate is Live2DExpressionAssetCandidate => candidate !== null),
  );
}

export function resolveLive2DMotionAssetsFromDirectoryEntries(
  entries: Live2DDirectoryEntryLike[],
  modelUrl: string,
) {
  return dedupeMotionAssetCandidates(
    entries
      .filter((entry) => entry.kind === 'file')
      .map((entry): Live2DMotionAssetCandidate | null => {
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!/\.motion3\.json$/iu.test(name)) {
          return null;
        }

        const sourcePath = typeof entry.path === 'string' && entry.path.trim()
          ? entry.path.trim()
          : name;
        return {
          name: stripLive2DMotionExtension(name),
          sourceUrl: resolve3DModelDependencyUrl(sourcePath, modelUrl),
        };
      })
      .filter((candidate): candidate is Live2DMotionAssetCandidate => candidate !== null),
  );
}

export function createLive2DExpressionMotionBindings(
  candidates: Live2DExpressionAssetCandidate[],
  options: {
    idPrefix: string;
    startIndex?: number;
  },
) {
  return dedupeExpressionAssetCandidates(candidates).map((candidate, index) => ({
    clipNames: [candidate.name],
    format: 'exp3',
    id: `${options.idPrefix}:expression:${(options.startIndex ?? 0) + index}:${candidate.name}`,
    kind: 'expression',
    motionKey: guessLive2DExpressionMotionKeyFromName(candidate.name),
    name: candidate.name,
    semanticAliases: [],
    semanticDescription: `Live2D expression imported from ${candidate.name}.`,
    semanticTags: ['Live2D', '表情'],
    sourceUrl: candidate.sourceUrl,
  } satisfies PetModelMotionBinding));
}

export function createLive2DMotionBindings(
  candidates: Live2DMotionAssetCandidate[],
  options: {
    idPrefix: string;
    startIndex?: number;
  },
) {
  return dedupeMotionAssetCandidates(candidates).map((candidate, index) => ({
    clipNames: [candidate.name],
    durationMs: candidate.durationMs,
    format: 'motion3',
    id: `${options.idPrefix}:motion:${(options.startIndex ?? 0) + index}:${candidate.name}`,
    kind: 'motion',
    motionKey: guessLive2DMotionKeyFromName(candidate.name),
    name: candidate.name,
    semanticAliases: [],
    semanticDescription: `Live2D motion imported from ${candidate.name}.`,
    semanticTags: ['Live2D', 'motion'],
    sourceUrl: candidate.sourceUrl,
  } satisfies PetModelMotionBinding));
}
