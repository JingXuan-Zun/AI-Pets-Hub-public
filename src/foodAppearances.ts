import foodGreenBundle from './assets/food/food-green-bundle.svg';
import foodMacaroni from './assets/food/food-macaroni.svg';
import foodOctopusPlatter from './assets/food/food-octopus-platter.svg';
import foodSeafoodPasta from './assets/food/food-seafood-pasta.svg';
import foodPudding from './assets/food/food-pudding.svg';
import foodNoodleSalad from './assets/food/food-noodle-salad.svg';
import { type FoodAppearance, type FolderItem, type PetItemInteractionType } from './types';

export const MAX_FOOD_APPEARANCES = 20;

export const DEFAULT_FOOD_APPEARANCES: FoodAppearance[] = [
  {
    id: 'food-green-bundle',
    name: '青菜卷',
    imageUrl: foodGreenBundle,
    builtIn: true,
    interactionType: 'eat',
  },
  {
    id: 'food-macaroni',
    name: '金黄通心粉',
    imageUrl: foodMacaroni,
    builtIn: true,
    interactionType: 'eat',
  },
  {
    id: 'food-octopus-platter',
    name: '章鱼拼盘',
    imageUrl: foodOctopusPlatter,
    builtIn: true,
    interactionType: 'eat',
  },
  {
    id: 'food-seafood-pasta',
    name: '海鲜意面',
    imageUrl: foodSeafoodPasta,
    builtIn: true,
    interactionType: 'eat',
  },
  {
    id: 'food-pudding',
    name: '布丁杯',
    imageUrl: foodPudding,
    builtIn: true,
    interactionType: 'eat',
  },
  {
    id: 'food-noodle-salad',
    name: '蔬菜炒面',
    imageUrl: foodNoodleSalad,
    builtIn: true,
    interactionType: 'eat',
  },
];

function hashFolderId(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function normalizeFoodAppearances(input: FoodAppearance[] | undefined | null) {
  if (!Array.isArray(input)) {
    return DEFAULT_FOOD_APPEARANCES.slice(0, MAX_FOOD_APPEARANCES);
  }

  return input
    .filter((appearance) => (
      appearance
      && typeof appearance.id === 'string'
      && typeof appearance.name === 'string'
      && typeof appearance.imageUrl === 'string'
      && appearance.imageUrl.trim().length > 0
    ))
    .slice(0, MAX_FOOD_APPEARANCES)
    .map((appearance) => ({
      id: appearance.id,
      name: appearance.name,
      imageUrl: appearance.imageUrl,
      builtIn: Boolean(appearance.builtIn),
      interactionType: (appearance.interactionType === 'toy' || appearance.interactionType === 'custom'
        ? appearance.interactionType : 'eat') as PetItemInteractionType,
      interactionLabel: typeof appearance.interactionLabel === 'string'
        ? appearance.interactionLabel.trim().slice(0, 30) : undefined,
    }));
}

export function resolveFoodInteractionType(
  folder: FolderItem,
  appearances: FoodAppearance[],
): PetItemInteractionType {
  const appearanceType = resolveFoodAppearanceForFolder(folder, appearances)?.interactionType;
  if (appearanceType === 'custom') return 'custom';
  if (folder.interactionType === 'toy' || appearanceType === 'toy') return 'toy';
  return 'eat';
}

export function pickRandomFoodAppearanceId(appearances: FoodAppearance[]) {
  if (!appearances.length) {
    return null;
  }

  const nextIndex = Math.floor(Math.random() * appearances.length);
  return appearances[nextIndex]?.id ?? null;
}

export function resolveFoodAppearanceForFolder(
  folder: FolderItem,
  appearances: FoodAppearance[],
) {
  if (!appearances.length) {
    return null;
  }

  if (folder.appearanceId) {
    return appearances.find((appearance) => appearance.id === folder.appearanceId) ?? null;
  }

  const fallbackIndex = hashFolderId(folder.id) % appearances.length;
  return appearances[fallbackIndex] ?? null;
}
