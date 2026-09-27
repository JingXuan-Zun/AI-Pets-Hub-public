import assert from 'node:assert/strict';
import {
  createDesktopOrganizationIconPositionSourceSummary,
  createDesktopOrganizationObservationEvidence,
  findDesktopOrganizationTargetDisplay,
  formatDesktopOrganizationIconPositionSourceSummary,
  normalizeDesktopOrganizationDisplayRect,
  type DesktopPetDesktopIconLike,
  type DesktopPetDisplayLike,
} from '../src/agent/index.ts';

const displays: DesktopPetDisplayLike[] = [
  {
    height: 1080,
    id: 'primary-display',
    isPrimary: true,
    label: 'primary display',
    width: 1920,
    workAreaHeight: 1040,
    workAreaWidth: 1920,
    workAreaX: 0,
    workAreaY: 0,
    x: 0,
    y: 0,
  },
  {
    height: 1440,
    id: 'secondary-display',
    isPrimary: false,
    label: 'secondary display',
    width: 2560,
    workAreaHeight: 1400,
    workAreaWidth: 2560,
    workAreaX: 1920,
    workAreaY: 0,
    x: 1920,
    y: 0,
  },
];

const icons: DesktopPetDesktopIconLike[] = [
  {
    centerX: 100,
    centerY: 120,
    height: 64,
    id: 'primary-a',
    index: 0,
    canMove: true,
    positionSource: 'shell-list-view',
    name: 'primary A',
    width: 64,
    x: 68,
    y: 88,
  },
  {
    centerX: 220,
    centerY: 120,
    height: 64,
    id: 'primary-b',
    index: 1,
    canMove: false,
    positionSource: 'ui-automation',
    name: 'primary B',
    width: 64,
    x: 188,
    y: 88,
  },
  {
    centerX: 2040,
    centerY: 120,
    height: 64,
    id: 'secondary-a',
    index: 2,
    canMove: true,
    positionSource: 'folder-view',
    name: 'secondary A',
    width: 64,
    x: 2008,
    y: 88,
  },
];

const secondaryDisplay = findDesktopOrganizationTargetDisplay(displays, 'secondary');
assert.equal(secondaryDisplay?.id, 'secondary-display');

const evidence = createDesktopOrganizationObservationEvidence({
  displays,
  effectiveScope: 'display-icons',
  icons,
  selectedIcons: icons.filter((icon) => icon.id === 'secondary-a'),
  selectedIconCount: 1,
  targetDisplay: secondaryDisplay,
  targetDisplayLabel: 'secondary display',
  targetViewport: normalizeDesktopOrganizationDisplayRect(secondaryDisplay!),
});

assert.equal(evidence.displayCount, 2);
assert.equal(evidence.totalIconCount, 3);
assert.equal(evidence.targetIconCount, 1);
assert.equal(evidence.selectedIconCount, 1);
assert.equal(evidence.displays.find((display) => display.id === 'secondary-display')?.selectedIconCount, 1);
assert.equal(evidence.observations.some((line) => line.startsWith('Desktop selected icons by display:')), true);
assert.equal(evidence.willMoveAcrossDisplays, false);
assert.match(evidence.summaryLine, /2/u);
assert.match(evidence.iconCountLine, /2/u);
assert.match(evidence.iconCountLine, /1/u);
assert.match(evidence.processingLine, /1\/1/u);
assert.equal(evidence.observations.includes('Desktop organization cross-display move: no'), true);

const sourceSummary = createDesktopOrganizationIconPositionSourceSummary(icons);
assert.equal(sourceSummary.totalIconCount, 3);
assert.equal(sourceSummary.movableIconCount, 2);
assert.equal(sourceSummary.readOnlyIconCount, 1);
assert.equal(sourceSummary.sources.find((source) => source.source === 'shell-list-view')?.movableCount, 1);
assert.equal(sourceSummary.sources.find((source) => source.source === 'ui-automation')?.readOnlyCount, 1);
assert.match(formatDesktopOrganizationIconPositionSourceSummary(sourceSummary), /movable=2\/3/u);

const allIconsEvidence = createDesktopOrganizationObservationEvidence({
  displays,
  effectiveScope: 'all-icons',
  icons,
  selectedIconCount: 3,
  targetDisplay: secondaryDisplay,
  targetDisplayLabel: 'secondary display',
  targetViewport: normalizeDesktopOrganizationDisplayRect(secondaryDisplay!),
});

assert.equal(allIconsEvidence.willMoveAcrossDisplays, true);
assert.match(allIconsEvidence.processingLine, /3\/3/u);
assert.equal(allIconsEvidence.observations.includes('Desktop organization cross-display move: yes'), true);

console.log('agent desktop observation evidence smoke ok');
