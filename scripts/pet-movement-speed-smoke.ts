// Pets walk at their set speed on any refresh rate, slot 1 like the others, and nobody jumps
// (user report 2026-11-18: 小玲 too fast; other pets suddenly thrown sideways). Measured on a
// 165 Hz screen before/after: 小玲 ~280 → ~105 px/s, others ~158 → ~70 px/s, 0 jumps, 0 loops.
import assert from 'node:assert/strict';
import { resolveMainPetRoamProfile } from '../src/pet-runtime/core/petMovementController';
import { resolveRoamProfile as resolveCompanionRoamProfile } from '../src/pet-runtime/companion/companionPetRuntimeUtils';
import { readProjectFile } from './smokeTestHarness.ts';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };

const maxSpeed = (pick: () => { speed: number }) => Math.max(...Array.from({ length: 200 }, () => pick().speed));
for (const hunger of [10, 50, 95]) {
  const primary = maxSpeed(() => resolveMainPetRoamProfile(hunger, 30, 80));
  const companion = maxSpeed(() => resolveCompanionRoamProfile(hunger, 30, 80));
  check(primary <= 112 && primary <= companion + 24, `slot 1 roams no faster than the others (hunger ${hunger}: ${primary} vs ${companion})`);
}

const stepper = readProjectFile('src/pet-runtime/core/useMainPetMovementStepper.ts');
const cleanup = stepper.slice(stepper.indexOf('return () => {'), stepper.indexOf('}, [', stepper.indexOf('return () => {')));
check(!/lastFrameTimeRef\.current = null/u.test(cleanup), 'slot 1: re-attaching the step does not reset the frame clock');
check(/movedDistance < Math\.min\(0\.5, maxStep \* 0\.25\)/u.test(stepper), 'slot 1: "blocked" is relative to the step size');

const companionStep = readProjectFile('src/pet-runtime/companion/companionMotionTickHelpers.ts');
check(!/Math\.max\(1, plan\.speed \* deltaSeconds\)/u.test(companionStep), 'other pets: no 1 px minimum step');
check(/movedDistance < Math\.min\(0\.5, maxStep \* 0\.25\)/u.test(companionStep), 'other pets: "blocked" is relative to the step size');
check(/stepToward\(currentPosition, resolvedStep, maxStep \* 1\.5\)/u.test(companionStep), 'other pets: glide around others instead of jumping');
check(/TARGET_RECHECK_MS/u.test(companionStep), 'other pets: the walk target is re-checked twice a second, not every frame');

const helpers = readProjectFile('src/components/pet/usePetContainerMovementHelpers.ts');
check(/companionRenderedPositionByIdRef\?\.current\[pet\.id\] \?\? pet\.position/u.test(helpers), 'collisions use where the others are now');
const sync = readProjectFile('src/components/pet/usePetContainerCompanionCollisionSyncEffect.ts');
check(/A pet in the middle of a walk/u.test(sync), 'the push-apart step leaves walking pets alone');

check(/regionsKey/u.test(readProjectFile('src/pet-runtime/interactions/usePetHoverController.ts')), 'hover effects keyed by region names (no update loop)');
check(/FACE_TURN_MIN_INTERVAL_MS/u.test(readProjectFile('src/components/PetModel2D.tsx')), '2D pets do not flip-flop their facing (no update loop)');

console.log(`pet movement speed smoke ok: ${checks} checks`);
