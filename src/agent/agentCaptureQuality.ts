import { type AgentCoordinateAuditEvidence } from './agentCoordinateAudit';
import { type AgentCoordinateHarnessResult } from './agentCoordinateHarness';

export type AgentCaptureStatus =
  | 'capture_ok'
  | 'capture_black_frame'
  | 'capture_low_entropy'
  | 'capture_fallback_screen_crop'
  | 'capture_untrusted';

export interface AgentCaptureQualityMetrics {
  dominantColorRatio: number;
  entropy: number;
  height: number;
  lumaStdDev: number;
  meanLuma: number;
  nearBlackRatio: number;
  sampledPixelCount: number;
  uniqueColorBucketCount: number;
  width: number;
}

export interface AgentCaptureQualityAnalysis {
  metrics: AgentCaptureQualityMetrics;
  reason: string;
  status: AgentCaptureStatus;
  trusted: boolean;
}

export interface AgentCaptureRectLike {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface AgentCaptureSourceGeometryLike {
  bounds?: AgentCaptureRectLike | null;
  height?: number | null;
  width?: number | null;
}

export interface AgentInputReplayPreview {
  afterCaptureStatus?: AgentCaptureStatus | null;
  afterRedDotDataUrl?: string | null;
  beforeCaptureStatus?: AgentCaptureStatus | null;
  beforeRedDotDataUrl?: string | null;
  clickPoint?: {
    x: number;
    y: number;
  } | null;
  coordinateAudit?: AgentCoordinateAuditEvidence | null;
  coordinateClosure?: AgentCoordinateHarnessResult | null;
  coordinateClosureStatus?: AgentCoordinateHarnessResult['status'] | null;
  screenSource?: string | null;
  uiChanged?: boolean | null;
  visualDeltaRatio?: number | null;
}

const CAPTURE_ANALYSIS_MAX_SAMPLE_COUNT = 12_000;
const CAPTURE_PREVIEW_MAX_SIDE = 480;
const CAPTURE_COMPARE_SIZE = 96;

function clampAgentCaptureNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundAgentCaptureMetric(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createAgentCaptureEmptyMetrics(width: number, height: number): AgentCaptureQualityMetrics {
  return {
    dominantColorRatio: 1,
    entropy: 0,
    height: Math.max(0, Math.round(height)),
    lumaStdDev: 0,
    meanLuma: 0,
    nearBlackRatio: 1,
    sampledPixelCount: 0,
    uniqueColorBucketCount: 0,
    width: Math.max(0, Math.round(width)),
  };
}

function classifyAgentCaptureMetrics(metrics: AgentCaptureQualityMetrics): AgentCaptureQualityAnalysis {
  if (metrics.width <= 0 || metrics.height <= 0 || metrics.sampledPixelCount <= 0) {
    return {
      metrics,
      reason: 'Capture image has no readable pixels.',
      status: 'capture_untrusted',
      trusted: false,
    };
  }

  const isBlackFrame = metrics.nearBlackRatio >= 0.985
    && metrics.entropy <= 0.28
    && metrics.uniqueColorBucketCount <= 4
    && metrics.lumaStdDev <= 2.5;
  if (isBlackFrame) {
    return {
      metrics,
      reason: 'Capture frame is almost entirely near-black with very low entropy.',
      status: 'capture_black_frame',
      trusted: false,
    };
  }

  const isLowEntropyFrame = (
    metrics.dominantColorRatio >= 0.992
    && metrics.entropy <= 0.22
    && metrics.lumaStdDev <= 2.8
  ) || (
    metrics.uniqueColorBucketCount <= 2
    && metrics.entropy <= 0.18
    && metrics.lumaStdDev <= 2
  ) || (
    metrics.nearBlackRatio >= 0.965
    && metrics.uniqueColorBucketCount <= 8
    && metrics.entropy <= 0.46
    && metrics.lumaStdDev <= 4
  );
  if (isLowEntropyFrame) {
    return {
      metrics,
      reason: 'Capture frame has too little visual information for reliable UI reasoning.',
      status: 'capture_low_entropy',
      trusted: false,
    };
  }

  return {
    metrics,
    reason: 'Capture frame has enough color and brightness variation to inspect.',
    status: 'capture_ok',
    trusted: true,
  };
}

export function analyzeAgentCapturePixels(options: {
  data: ArrayLike<number>;
  height: number;
  width: number;
}): AgentCaptureQualityAnalysis {
  const width = Math.max(0, Math.round(options.width));
  const height = Math.max(0, Math.round(options.height));
  const pixelCount = width * height;
  if (pixelCount <= 0 || options.data.length < 4) {
    return classifyAgentCaptureMetrics(createAgentCaptureEmptyMetrics(width, height));
  }

  const stride = Math.max(1, Math.floor(pixelCount / CAPTURE_ANALYSIS_MAX_SAMPLE_COUNT));
  const buckets = new Map<number, number>();
  let sampledPixelCount = 0;
  let nearBlackCount = 0;
  let lumaSum = 0;
  let lumaSquaredSum = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += stride) {
    const offset = pixelIndex * 4;
    const alpha = options.data[offset + 3] ?? 255;
    const alphaRatio = clampAgentCaptureNumber(alpha / 255, 0, 1);
    const red = (options.data[offset] ?? 0) * alphaRatio;
    const green = (options.data[offset + 1] ?? 0) * alphaRatio;
    const blue = (options.data[offset + 2] ?? 0) * alphaRatio;
    const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const bucket = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);

    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    if (luma <= 12 && red <= 18 && green <= 18 && blue <= 18) {
      nearBlackCount += 1;
    }
    lumaSum += luma;
    lumaSquaredSum += luma * luma;
    sampledPixelCount += 1;
  }

  if (sampledPixelCount <= 0) {
    return classifyAgentCaptureMetrics(createAgentCaptureEmptyMetrics(width, height));
  }

  let entropy = 0;
  let dominantColorCount = 0;
  for (const count of buckets.values()) {
    dominantColorCount = Math.max(dominantColorCount, count);
    const probability = count / sampledPixelCount;
    entropy -= probability * Math.log2(probability);
  }

  const meanLuma = lumaSum / sampledPixelCount;
  const variance = Math.max(0, (lumaSquaredSum / sampledPixelCount) - meanLuma * meanLuma);
  const metrics: AgentCaptureQualityMetrics = {
    dominantColorRatio: roundAgentCaptureMetric(dominantColorCount / sampledPixelCount),
    entropy: roundAgentCaptureMetric(entropy),
    height,
    lumaStdDev: roundAgentCaptureMetric(Math.sqrt(variance), 3),
    meanLuma: roundAgentCaptureMetric(meanLuma, 3),
    nearBlackRatio: roundAgentCaptureMetric(nearBlackCount / sampledPixelCount),
    sampledPixelCount,
    uniqueColorBucketCount: buckets.size,
    width,
  };

  return classifyAgentCaptureMetrics(metrics);
}

function loadAgentCaptureImage(imageDataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image API is unavailable for capture analysis.'));
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load capture image.'));
    image.src = imageDataUrl;
  });
}

function createAgentCaptureCanvas(width: number, height: number) {
  if (typeof document === 'undefined') {
    throw new Error('Document API is unavailable for capture analysis.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Unable to create capture analysis canvas.');
  }

  return { canvas, context };
}

export async function analyzeAgentCaptureDataUrl(imageDataUrl: string): Promise<AgentCaptureQualityAnalysis> {
  if (!imageDataUrl.trim()) {
    return classifyAgentCaptureMetrics(createAgentCaptureEmptyMetrics(0, 0));
  }

  const image = await loadAgentCaptureImage(imageDataUrl);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (imageWidth <= 0 || imageHeight <= 0) {
    return classifyAgentCaptureMetrics(createAgentCaptureEmptyMetrics(imageWidth, imageHeight));
  }

  const scale = Math.min(1, Math.sqrt(CAPTURE_ANALYSIS_MAX_SAMPLE_COUNT / (imageWidth * imageHeight)));
  const width = Math.max(1, Math.round(imageWidth * scale));
  const height = Math.max(1, Math.round(imageHeight * scale));
  const { context } = createAgentCaptureCanvas(width, height);
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);

  return analyzeAgentCapturePixels({
    data: imageData.data,
    height,
    width,
  });
}

export function formatAgentCaptureQualityLine(
  analysis: AgentCaptureQualityAnalysis,
  prefix = 'Capture quality',
) {
  const metrics = analysis.metrics;
  return [
    `${prefix}: status=${analysis.status}`,
    `trusted=${analysis.trusted}`,
    `nearBlack=${metrics.nearBlackRatio}`,
    `entropy=${metrics.entropy}`,
    `uniqueBuckets=${metrics.uniqueColorBucketCount}`,
    `dominant=${metrics.dominantColorRatio}`,
    `lumaStdDev=${metrics.lumaStdDev}`,
    `reason=${analysis.reason}`,
  ].join(' | ');
}

function resolveAgentCaptureSourceBounds(source: AgentCaptureSourceGeometryLike) {
  const bounds = source.bounds;
  if (
    bounds
    && Number.isFinite(Number(bounds.x))
    && Number.isFinite(Number(bounds.y))
    && Number.isFinite(Number(bounds.width))
    && Number.isFinite(Number(bounds.height))
    && Number(bounds.width) > 0
    && Number(bounds.height) > 0
  ) {
    return {
      height: Math.round(Number(bounds.height)),
      width: Math.round(Number(bounds.width)),
      x: Math.round(Number(bounds.x)),
      y: Math.round(Number(bounds.y)),
    };
  }

  if (
    Number.isFinite(Number(source.width))
    && Number.isFinite(Number(source.height))
    && Number(source.width) > 0
    && Number(source.height) > 0
  ) {
    return {
      height: Math.round(Number(source.height)),
      width: Math.round(Number(source.width)),
      x: 0,
      y: 0,
    };
  }

  return null;
}

function resolveAgentCapturePointRatio(
  source: AgentCaptureSourceGeometryLike,
  point: { x: number; y: number },
) {
  const bounds = resolveAgentCaptureSourceBounds(source);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const xRatio = (point.x - bounds.x) / bounds.width;
  const yRatio = (point.y - bounds.y) / bounds.height;
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
    return null;
  }

  return {
    x: xRatio,
    y: yRatio,
  };
}

export async function createAgentCaptureRedDotPreview(options: {
  imageDataUrl: string;
  point: { x: number; y: number };
  source: AgentCaptureSourceGeometryLike;
}) {
  const image = await loadAgentCaptureImage(options.imageDataUrl);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('Capture preview image has invalid dimensions.');
  }

  const scale = Math.min(1, CAPTURE_PREVIEW_MAX_SIDE / Math.max(imageWidth, imageHeight));
  const outputWidth = Math.max(1, Math.round(imageWidth * scale));
  const outputHeight = Math.max(1, Math.round(imageHeight * scale));
  const { canvas, context } = createAgentCaptureCanvas(outputWidth, outputHeight);
  context.drawImage(image, 0, 0, outputWidth, outputHeight);

  const ratio = resolveAgentCapturePointRatio(options.source, options.point);
  if (ratio) {
    const dotX = ratio.x * outputWidth;
    const dotY = ratio.y * outputHeight;
    const radius = Math.max(5, Math.round(Math.min(outputWidth, outputHeight) * 0.018));
    context.save();
    context.beginPath();
    context.arc(dotX, dotY, radius + 3, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255,255,255,0.92)';
    context.fill();
    context.beginPath();
    context.arc(dotX, dotY, radius, 0, Math.PI * 2);
    context.fillStyle = 'rgba(239,68,68,0.96)';
    context.fill();
    context.lineWidth = Math.max(2, Math.round(radius * 0.35));
    context.strokeStyle = 'rgba(127,29,29,0.95)';
    context.stroke();
    context.restore();
  }

  return canvas.toDataURL('image/png');
}

async function renderAgentCaptureCompareData(imageDataUrl: string) {
  const image = await loadAgentCaptureImage(imageDataUrl);
  const { context } = createAgentCaptureCanvas(CAPTURE_COMPARE_SIZE, CAPTURE_COMPARE_SIZE);
  context.drawImage(image, 0, 0, CAPTURE_COMPARE_SIZE, CAPTURE_COMPARE_SIZE);
  return context.getImageData(0, 0, CAPTURE_COMPARE_SIZE, CAPTURE_COMPARE_SIZE).data;
}

export async function compareAgentCaptureDataUrls(beforeDataUrl: string, afterDataUrl: string) {
  const [beforeData, afterData] = await Promise.all([
    renderAgentCaptureCompareData(beforeDataUrl),
    renderAgentCaptureCompareData(afterDataUrl),
  ]);
  const pixelCount = CAPTURE_COMPARE_SIZE * CAPTURE_COMPARE_SIZE;
  let changedCount = 0;
  let diffSum = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const diff = (
      Math.abs((beforeData[offset] ?? 0) - (afterData[offset] ?? 0))
      + Math.abs((beforeData[offset + 1] ?? 0) - (afterData[offset + 1] ?? 0))
      + Math.abs((beforeData[offset + 2] ?? 0) - (afterData[offset + 2] ?? 0))
    ) / 3;
    if (diff >= 18) {
      changedCount += 1;
    }
    diffSum += diff;
  }

  const changedRatio = changedCount / pixelCount;
  const meanDiff = diffSum / pixelCount;
  return {
    changedRatio: roundAgentCaptureMetric(changedRatio),
    meanDiff: roundAgentCaptureMetric(meanDiff, 3),
    uiChanged: changedRatio >= 0.012 || meanDiff >= 4.5,
  };
}
