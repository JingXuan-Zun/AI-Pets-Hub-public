import { type PetConfig } from './types';

type IndexedObject = Record<string, unknown> & { id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIndexedObject(value: unknown): value is IndexedObject {
  return isRecord(value) && typeof value.id === 'string' && value.id.trim().length > 0;
}

function valuesMatch(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => valuesMatch(item, right[index]));
  }

  if (isRecord(left) && isRecord(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return Array.from(keys).every((key) => valuesMatch(left[key], right[key]));
  }

  return false;
}

function mergeIndexedArray(baseValue: IndexedObject[], nextValue: IndexedObject[], currentValue: unknown[]) {
  const baseById = new Map(baseValue.map((item) => [item.id, item]));
  const nextById = new Map(nextValue.map((item) => [item.id, item]));
  const currentById = new Map(currentValue.filter(isIndexedObject).map((item) => [item.id, item]));

  return nextValue.map((nextItem) => {
    const baseItem = baseById.get(nextItem.id);
    if (!baseItem) {
      return nextItem;
    }

    const currentItem = currentById.get(nextItem.id);
    if (!currentItem) {
      return nextItem;
    }

    return mergeChangedValue(baseItem, nextItem, currentItem);
  }).filter((item) => nextById.has((item as IndexedObject).id));
}

function mergeChangedArray(baseValue: unknown[], nextValue: unknown[], currentValue: unknown) {
  if (valuesMatch(baseValue, nextValue)) {
    return currentValue;
  }

  if (
    Array.isArray(currentValue)
    && baseValue.every(isIndexedObject)
    && nextValue.every(isIndexedObject)
  ) {
    return mergeIndexedArray(baseValue, nextValue, currentValue);
  }

  return nextValue;
}

function mergeChangedObject(
  baseValue: Record<string, unknown>,
  nextValue: Record<string, unknown>,
  currentValue: unknown,
) {
  if (valuesMatch(baseValue, nextValue)) {
    return currentValue;
  }

  if (!isRecord(currentValue)) {
    return nextValue;
  }

  const mergedValue: Record<string, unknown> = { ...currentValue };
  const keys = new Set([...Object.keys(baseValue), ...Object.keys(nextValue)]);

  keys.forEach((key) => {
    mergedValue[key] = mergeChangedValue(baseValue[key], nextValue[key], currentValue[key]);
  });

  return mergedValue;
}

function mergeChangedValue(baseValue: unknown, nextValue: unknown, currentValue: unknown): unknown {
  if (valuesMatch(baseValue, nextValue)) {
    return currentValue;
  }

  if (Array.isArray(baseValue) && Array.isArray(nextValue)) {
    return mergeChangedArray(baseValue, nextValue, currentValue);
  }

  if (isRecord(baseValue) && isRecord(nextValue)) {
    return mergeChangedObject(baseValue, nextValue, currentValue);
  }

  return nextValue;
}

export function mergePetConfigUpdateFromBase(
  baseConfig: PetConfig,
  nextConfig: PetConfig,
  currentConfig: PetConfig,
) {
  return mergeChangedValue(
    baseConfig,
    nextConfig,
    currentConfig,
  ) as PetConfig;
}
