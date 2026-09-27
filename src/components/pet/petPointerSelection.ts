export const PET_POINTER_HIT_AREA_SELECTOR = '[data-desktop-pet-interactive="true"][data-desktop-pet-id]';

type PetPointerSelectionEventLike = {
  clientX: number;
  clientY: number;
  currentTarget: {
    ownerDocument: Document;
  };
};

type PetPointerHitCandidate = {
  centerDistance: number;
  petId: string;
};

const PET_SELECTION_SCORE_LEFT_ATTR = 'data-desktop-pet-selection-score-left';
const PET_SELECTION_SCORE_TOP_ATTR = 'data-desktop-pet-selection-score-top';
const PET_SELECTION_SCORE_WIDTH_ATTR = 'data-desktop-pet-selection-score-width';
const PET_SELECTION_SCORE_HEIGHT_ATTR = 'data-desktop-pet-selection-score-height';

type PetPointerSelectionTargetOptions = {
  currentPetId: string;
  selectedPetId?: string | null;
  stackedPetIds: string[];
};

type PetPointerSelectionCandidateOptions = Omit<PetPointerSelectionTargetOptions, 'stackedPetIds'> & {
  candidates: PetPointerHitCandidate[];
};

function uniquePetIds(petIds: string[]) {
  const seenPetIds = new Set<string>();
  return petIds.filter((petId) => {
    if (!petId || seenPetIds.has(petId)) {
      return false;
    }

    seenPetIds.add(petId);
    return true;
  });
}

export function resolvePetPointerHitStackFromPoint(
  ownerDocument: Document,
  clientX: number,
  clientY: number,
) {
  return resolvePetPointerHitCandidatesFromPoint(ownerDocument, clientX, clientY)
    .map((candidate) => candidate.petId);
}

export function resolvePetPointerHitCandidatesFromPoint(
  ownerDocument: Document,
  clientX: number,
  clientY: number,
): PetPointerHitCandidate[] {
  const elements = typeof ownerDocument.elementsFromPoint === 'function'
    ? ownerDocument.elementsFromPoint(clientX, clientY)
    : [ownerDocument.elementFromPoint(clientX, clientY)].filter((element): element is Element => Boolean(element));
  const seenPetIds = new Set<string>();
  const candidates = elements.reduce<PetPointerHitCandidate[]>((nextCandidates, element) => {
    const hitArea = element.closest(PET_POINTER_HIT_AREA_SELECTOR);
    pushPetPointerHitCandidate(nextCandidates, seenPetIds, hitArea, clientX, clientY);
    return nextCandidates;
  }, []);

  if (typeof ownerDocument.querySelectorAll === 'function') {
    ownerDocument.querySelectorAll(PET_POINTER_HIT_AREA_SELECTOR).forEach((hitArea) => {
      pushPetPointerHitCandidate(candidates, seenPetIds, hitArea, clientX, clientY, true);
    });
  }

  return candidates.sort((left, right) => left.centerDistance - right.centerDistance);
}

function isPointInsideRect(
  rect: DOMRect,
  clientX: number,
  clientY: number,
) {
  return clientX >= rect.left
    && clientX <= rect.right
    && clientY >= rect.top
    && clientY <= rect.bottom;
}

function pushPetPointerHitCandidate(
  candidates: PetPointerHitCandidate[],
  seenPetIds: Set<string>,
  hitArea: Element | null,
  clientX: number,
  clientY: number,
  requirePointInside = false,
) {
  const petId = hitArea?.getAttribute('data-desktop-pet-id') ?? '';
  if (!hitArea || !petId || seenPetIds.has(petId)) {
    return;
  }

  const rect = hitArea.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  if (requirePointInside && !isPointInsideRect(rect, clientX, clientY)) {
    return;
  }

  seenPetIds.add(petId);
  const scoreRect = resolvePetPointerSelectionScoreRect(hitArea, rect);
  const normalizedDeltaX = (clientX - (scoreRect.left + scoreRect.width / 2)) / Math.max(1, scoreRect.width);
  const normalizedDeltaY = (clientY - (scoreRect.top + scoreRect.height / 2)) / Math.max(1, scoreRect.height);
  candidates.push({
    centerDistance: Math.hypot(normalizedDeltaX, normalizedDeltaY),
    petId,
  });
}

function readScoreRectRatio(hitArea: Element, name: string) {
  const value = Number.parseFloat(hitArea.getAttribute(name) ?? '');
  return Number.isFinite(value) ? value : null;
}

function resolvePetPointerSelectionScoreRect(
  hitArea: Element,
  rect: DOMRect,
) {
  const leftRatio = readScoreRectRatio(hitArea, PET_SELECTION_SCORE_LEFT_ATTR);
  const topRatio = readScoreRectRatio(hitArea, PET_SELECTION_SCORE_TOP_ATTR);
  const widthRatio = readScoreRectRatio(hitArea, PET_SELECTION_SCORE_WIDTH_ATTR);
  const heightRatio = readScoreRectRatio(hitArea, PET_SELECTION_SCORE_HEIGHT_ATTR);

  if (
    leftRatio === null
    || topRatio === null
    || widthRatio === null
    || heightRatio === null
    || widthRatio <= 0
    || heightRatio <= 0
  ) {
    return rect;
  }

  return {
    height: Math.max(1, rect.height * Math.min(1, heightRatio)),
    left: rect.left + rect.width * Math.max(0, Math.min(1, leftRatio)),
    top: rect.top + rect.height * Math.max(0, Math.min(1, topRatio)),
    width: Math.max(1, rect.width * Math.min(1, widthRatio)),
  };
}

export function resolveStackedPetSelectionTarget({
  currentPetId,
  selectedPetId = null,
  stackedPetIds,
}: PetPointerSelectionTargetOptions) {
  const hitPetIds = uniquePetIds(stackedPetIds);
  return resolveStackedPetSelectionTargetFromCandidates({
    currentPetId,
    selectedPetId,
    candidates: hitPetIds.map((petId, index) => ({
      centerDistance: index,
      petId,
    })),
  });
}

export function resolveStackedPetSelectionTargetFromCandidates({
  candidates,
  currentPetId,
  selectedPetId = null,
}: PetPointerSelectionCandidateOptions) {
  const hitPetIds = uniquePetIds(candidates.map((candidate) => candidate.petId));
  const currentIndex = hitPetIds.indexOf(currentPetId);
  if (hitPetIds.length <= 1 || currentIndex < 0) {
    return currentPetId;
  }

  const selectedBias = 0.01;
  const bestCandidate = candidates
    .filter((candidate) => hitPetIds.includes(candidate.petId))
    .reduce<PetPointerHitCandidate | null>((bestCandidateSoFar, candidate) => {
      if (!bestCandidateSoFar) {
        return candidate;
      }

      const candidateScore = candidate.centerDistance - (candidate.petId === selectedPetId ? selectedBias : 0);
      const bestScore = bestCandidateSoFar.centerDistance - (bestCandidateSoFar.petId === selectedPetId ? selectedBias : 0);
      return candidateScore < bestScore ? candidate : bestCandidateSoFar;
    }, null);

  return bestCandidate?.petId ?? currentPetId;
}

export function resolveStackedPetSelectionTargetFromPointerEvent(
  event: PetPointerSelectionEventLike,
  options: Omit<PetPointerSelectionTargetOptions, 'stackedPetIds'>,
) {
  return resolveStackedPetSelectionTargetFromCandidates({
    ...options,
    candidates: resolvePetPointerHitCandidatesFromPoint(
      event.currentTarget.ownerDocument,
      event.clientX,
      event.clientY,
    ),
  });
}
