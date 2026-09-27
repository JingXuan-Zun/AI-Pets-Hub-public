import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  type ElementSnapshot,
  type Live2DDragProbeSample,
  type Position,
  roundProbeNumber,
} from './live2dDragReleaseProbeSample';

const TIMELINE_TARGETS_MS = [0, 32, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1600, 2400, 3200];

function parseDiagnosticNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeNumericSeries(values: Array<string | undefined>) {
  const numbers = values.map(parseDiagnosticNumber).filter((value): value is number => value !== null);
  if (numbers.length === 0) {
    return 'missing';
  }

  let maxStep = 0;
  let previousDirection = 0;
  let reversals = 0;
  for (let index = 1; index < numbers.length; index += 1) {
    const delta = numbers[index] - numbers[index - 1];
    maxStep = Math.max(maxStep, Math.abs(delta));
    if (Math.abs(delta) < 0.0005) {
      continue;
    }
    const direction = Math.sign(delta);
    reversals += previousDirection !== 0 && direction !== previousDirection ? 1 : 0;
    previousDirection = direction;
  }

  return [
    `range=${roundProbeNumber(Math.min(...numbers))}..${roundProbeNumber(Math.max(...numbers))}`,
    `maxStep=${roundProbeNumber(maxStep)}`,
    `reversals=${reversals}`,
  ].join(' ');
}

function summarizeValueSequence(values: Array<string | undefined>) {
  return values.reduce<string[]>((sequence, value) => {
    const normalized = value || 'missing';
    if (sequence.at(-1) !== normalized) {
      sequence.push(normalized);
    }
    return sequence;
  }, []).join('>');
}

function summarizeStepFrame(sample: Live2DDragProbeSample, value: number) {
  return {
    appliedSource: sample.live2d?.appliedSource ?? 'missing',
    tMs: sample.tMs,
    targetX: parseDiagnosticNumber(sample.live2d?.targetX),
    timedSource: sample.live2d?.timedSource ?? 'missing',
    value,
  };
}

function findLargestNumericStep(
  samples: Live2DDragProbeSample[],
  resolveValue: (sample: Live2DDragProbeSample) => string | undefined,
) {
  let largestStep: {
    from: ReturnType<typeof summarizeStepFrame>;
    step: number;
    to: ReturnType<typeof summarizeStepFrame>;
  } | null = null;

  for (let index = 1; index < samples.length; index += 1) {
    const previousValue = parseDiagnosticNumber(resolveValue(samples[index - 1]));
    const currentValue = parseDiagnosticNumber(resolveValue(samples[index]));
    if (previousValue === null || currentValue === null) {
      continue;
    }
    const step = Math.abs(currentValue - previousValue);
    if (!largestStep || step > largestStep.step) {
      largestStep = {
        from: summarizeStepFrame(samples[index - 1], previousValue),
        step: roundProbeNumber(step),
        to: summarizeStepFrame(samples[index], currentValue),
      };
    }
  }
  return largestStep;
}

function rectCenter(snapshot: ElementSnapshot) {
  return snapshot ? { x: snapshot.left + snapshot.width / 2, y: snapshot.top + snapshot.height / 2 } : null;
}

function distance(left: Position | null, right: Position | null) {
  if (!left || !right) {
    return 0;
  }
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function maxPointDrift(
  samples: Live2DDragProbeSample[],
  resolvePoint: (sample: Live2DDragProbeSample) => Position | null,
) {
  const firstPoint = resolvePoint(samples[0]);
  return roundProbeNumber(samples.reduce((maxDrift, sample) => (
    Math.max(maxDrift, distance(firstPoint, resolvePoint(sample)))
  ), 0));
}

function countDistinctValues(values: Array<string | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function summarizeProbeSamples(samples: Live2DDragProbeSample[]) {
  return {
    controller: {
      appliedSource: summarizeValueSequence(samples.map((sample) => sample.live2d?.appliedSource)),
      currentX: summarizeNumericSeries(samples.map((sample) => sample.live2d?.currentX)),
      currentY: summarizeNumericSeries(samples.map((sample) => sample.live2d?.currentY)),
      influence: summarizeNumericSeries(samples.map((sample) => sample.live2d?.parameterInfluence)),
      targetX: summarizeNumericSeries(samples.map((sample) => sample.live2d?.targetX)),
      targetY: summarizeNumericSeries(samples.map((sample) => sample.live2d?.targetY)),
      timedSource: summarizeValueSequence(samples.map((sample) => sample.live2d?.timedSource)),
    },
    head: {
      postX: summarizeNumericSeries(samples.map((sample) => sample.live2d?.postAngleX)),
      postY: summarizeNumericSeries(samples.map((sample) => sample.live2d?.postAngleY)),
      postZ: summarizeNumericSeries(samples.map((sample) => sample.live2d?.postAngleZ)),
      preX: summarizeNumericSeries(samples.map((sample) => sample.live2d?.preAngleX)),
      preY: summarizeNumericSeries(samples.map((sample) => sample.live2d?.preAngleY)),
      preZ: summarizeNumericSeries(samples.map((sample) => sample.live2d?.preAngleZ)),
    },
    lookSettle: summarizeValueSequence(samples.map((sample) => sample.live2d?.lookSettle)),
    lookSource: summarizeValueSequence(samples.map((sample) => sample.live2d?.lookSource)),
    physics: {
      angleX2: summarizeNumericSeries(samples.map((sample) => sample.live2d?.secondaryAngleX)),
      angleY2: summarizeNumericSeries(samples.map((sample) => sample.live2d?.secondaryAngleY)),
      angleZ2: summarizeNumericSeries(samples.map((sample) => sample.live2d?.secondaryAngleZ)),
      suppression: summarizeNumericSeries(samples.map((sample) => sample.live2d?.secondaryPhysicsSuppression)),
    },
  };
}

function selectTimelineSamples(samples: Live2DDragProbeSample[]) {
  const selectedIndexes = new Set<number>();
  TIMELINE_TARGETS_MS.forEach((targetMs) => {
    let closestIndex = 0;
    for (let index = 1; index < samples.length; index += 1) {
      if (Math.abs(samples[index].tMs - targetMs) < Math.abs(samples[closestIndex].tMs - targetMs)) {
        closestIndex = index;
      }
    }
    selectedIndexes.add(closestIndex);
  });
  return [...selectedIndexes].sort((left, right) => left - right).map((index) => samples[index]);
}

function logControllerFrame(sample: Live2DDragProbeSample, petId: string, probeRun: number) {
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release controller frame', {
    focusX: sample.focusTarget?.x ?? null,
    focusY: sample.focusTarget?.y ?? null,
    lookSettle: sample.live2d?.lookSettle ?? 'missing',
    lookSource: sample.live2d?.lookSource ?? 'missing',
    petId,
    probeRun,
    tMs: sample.tMs,
    targetX: parseDiagnosticNumber(sample.live2d?.targetX),
    targetY: parseDiagnosticNumber(sample.live2d?.targetY),
    timedSource: sample.live2d?.timedSource ?? 'missing',
  });
}

function logRenderedFrame(sample: Live2DDragProbeSample, petId: string, probeRun: number) {
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release rendered frame', {
    appliedSource: sample.live2d?.appliedSource ?? 'missing',
    currentX: parseDiagnosticNumber(sample.live2d?.currentX),
    currentY: parseDiagnosticNumber(sample.live2d?.currentY),
    influence: parseDiagnosticNumber(sample.live2d?.parameterInfluence),
    petId,
    postX: parseDiagnosticNumber(sample.live2d?.postAngleX),
    postY: parseDiagnosticNumber(sample.live2d?.postAngleY),
    postZ: parseDiagnosticNumber(sample.live2d?.postAngleZ),
    preX: parseDiagnosticNumber(sample.live2d?.preAngleX),
    preY: parseDiagnosticNumber(sample.live2d?.preAngleY),
    probeRun,
    tMs: sample.tMs,
  });
}

function logLargestStep(
  axis: string,
  step: ReturnType<typeof findLargestNumericStep>,
  petId: string,
  probeRun: number,
) {
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release largest head step', {
    axis,
    fromSource: step?.from.appliedSource ?? 'missing',
    fromT: step?.from.tMs ?? null,
    fromValue: step?.from.value ?? null,
    petId,
    probeRun,
    step: step?.step ?? null,
    toSource: step?.to.appliedSource ?? 'missing',
    toT: step?.to.tMs ?? null,
    toValue: step?.to.value ?? null,
  });
}

function logGeometrySummary(samples: Live2DDragProbeSample[], petId: string, probeRun: number) {
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release geometry summary', {
    canvas: maxPointDrift(samples, (sample) => rectCenter(sample.canvas)),
    canvasTransforms: countDistinctValues(samples.map((sample) => sample.canvas?.transform)),
    live2dRenderer: maxPointDrift(samples, (sample) => rectCenter(sample.live2d)),
    petId,
    probeRun,
    runtimePosition: maxPointDrift(samples, (sample) => sample.position),
    shell: maxPointDrift(samples, (sample) => rectCenter(sample.shell)),
    visualSurface: maxPointDrift(samples, (sample) => rectCenter(sample.visualSurface)),
    windowShape: maxPointDrift(samples, (sample) => rectCenter(sample.windowShape)),
  });
}

export function logLive2DDragProbeReport(options: {
  modelUrl: string;
  observeMs: number;
  petId: string;
  probeRun: number;
  samples: Live2DDragProbeSample[];
  scale: number;
  status: 'completed' | 'interrupted';
}) {
  const summary = summarizeProbeSamples(options.samples);
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release probe summary', {
    modelUrl: options.modelUrl,
    observeMs: options.observeMs,
    petId: options.petId,
    probeRun: options.probeRun,
    sampleCount: options.samples.length,
    scale: options.scale,
    status: options.status,
  });
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release controller summary', {
    ...summary.controller,
    lookSettle: summary.lookSettle,
    lookSource: summary.lookSource,
    petId: options.petId,
    probeRun: options.probeRun,
  });
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release head summary', {
    ...summary.head,
    ...summary.physics,
    petId: options.petId,
    probeRun: options.probeRun,
  });
  logGeometrySummary(options.samples, options.petId, options.probeRun);
  logLargestStep('postX', findLargestNumericStep(options.samples, (sample) => sample.live2d?.postAngleX), options.petId, options.probeRun);
  logLargestStep('postY', findLargestNumericStep(options.samples, (sample) => sample.live2d?.postAngleY), options.petId, options.probeRun);
  logLargestStep('postZ', findLargestNumericStep(options.samples, (sample) => sample.live2d?.postAngleZ), options.petId, options.probeRun);
  selectTimelineSamples(options.samples).forEach((sample) => {
    logControllerFrame(sample, options.petId, options.probeRun);
    logRenderedFrame(sample, options.petId, options.probeRun);
  });
}
