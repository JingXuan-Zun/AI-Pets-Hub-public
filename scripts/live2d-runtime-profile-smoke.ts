import assert from 'node:assert/strict';
import {
  normalizeLive2DRuntimeProfileConfig,
  resolveLive2DRuntimeProfile,
} from '../src/pet-runtime/live2d/live2dRuntimeProfile';

function createCoreModel(parameterIds: readonly string[]) {
  return {
    getParameterIndex: (parameterId: string) => parameterIds.indexOf(parameterId),
  };
}

const ordinaryProfile = resolveLive2DRuntimeProfile({
  coreModel: createCoreModel([
    'ParamAngleX',
    'ParamAngleY',
    'ParamAngleZ',
    'ParamBodyAngleX',
    'ParamBodyAngleY',
    'ParamBodyAngleZ',
    'ParamBreath',
    'ParamEyeBallX',
    'ParamEyeBallY',
  ]),
});
assert.equal(ordinaryProfile.parameters.lookX.id, 'ParamAngleX');
assert.equal(ordinaryProfile.capabilities.pointerLook, true);
assert.equal(ordinaryProfile.capabilities.bodySway, true);
assert.equal(ordinaryProfile.layout.canvasAnchorY, 0.52);
assert.equal(ordinaryProfile.layout.fitMode, 'visible-overflow');

const complexStandingProfile = resolveLive2DRuntimeProfile({
  coreModel: createCoreModel([
    'ParamAngleX',
    'ParamAngleY',
    'ParamAngleZ',
    'HeadAngleX',
    'HeadAngleY',
    'HeadAngleZ',
    'ChestX_input',
    'ChestY_input',
    'ChestZ_input',
    'ParamBodyAngleY',
    'ParamBodyAngleZ',
  ]),
});
assert.equal(complexStandingProfile.parameters.lookX.id, 'HeadAngleX');
assert.equal(complexStandingProfile.capabilities.complexPhysicsRig, true);
assert.equal(complexStandingProfile.capabilities.bodySway, false);

const mixedRigParameterIds = [
  'ParamAngleX',
  'ParamAngleY',
  'ParamAngleZ',
  'ParamBodyAngleX',
  'ParamBodyAngleY',
  'ParamBodyAngleZ',
  'HeadAngleX',
  'HeadAngleY',
  'HeadAngleZ',
  'ChestX_input',
  'ChestY_input',
  'ChestZ_input',
] as const;
const declaredOrdinaryProfile = resolveLive2DRuntimeProfile({
  coreModel: createCoreModel(mixedRigParameterIds),
  declaredParameterIds: new Set([
    'ParamAngleX',
    'ParamAngleY',
    'ParamAngleZ',
    'ParamBodyAngleX',
    'ParamBodyAngleY',
    'ParamBodyAngleZ',
  ]),
});
assert.equal(
  declaredOrdinaryProfile.parameters.lookX.id,
  'ParamAngleX',
  'a sitting model should prefer its publicly declared standard head control',
);
assert.equal(declaredOrdinaryProfile.capabilities.complexPhysicsRig, false);
assert.equal(declaredOrdinaryProfile.capabilities.bodySway, true);

const declaredComplexProfile = resolveLive2DRuntimeProfile({
  coreModel: createCoreModel(mixedRigParameterIds),
  declaredParameterIds: new Set([
    'HeadAngleX',
    'HeadAngleY',
    'HeadAngleZ',
    'ChestX_input',
    'ChestY_input',
    'ChestZ_input',
  ]),
});
assert.equal(
  declaredComplexProfile.parameters.lookX.id,
  'HeadAngleX',
  'a standing physics rig should prefer its publicly declared head output',
);
assert.equal(declaredComplexProfile.capabilities.complexPhysicsRig, true);
assert.equal(declaredComplexProfile.capabilities.bodySway, false);

const configuredProfile = resolveLive2DRuntimeProfile({
  config: {
    capabilities: {
      bodySway: true,
      eyeLook: false,
    },
    layout: {
      fitMode: 'canvas',
      offsetY: 0.18,
      scale: 0.82,
    },
    parameters: {
      lookX: {
        id: 'CustomLookX',
        invert: true,
        sensitivity: 0.7,
      },
      lookY: {
        enabled: false,
      },
    },
    profileVersion: 1,
  },
  coreModel: createCoreModel(['CustomLookX', 'ParamAngleY', 'ParamBodyAngleY', 'ParamBodyAngleZ']),
});
assert.equal(configuredProfile.parameters.lookX.id, 'CustomLookX');
assert.equal(configuredProfile.parameters.lookX.invert, true);
assert.equal(configuredProfile.parameters.lookX.sensitivity, 0.7);
assert.equal(configuredProfile.parameters.lookY.id, null);
assert.equal(configuredProfile.capabilities.bodySway, true);
assert.equal(configuredProfile.capabilities.eyeLook, false);
assert.equal(configuredProfile.layout.fitMode, 'canvas');
assert.equal(configuredProfile.layout.offsetY, 0.18);
assert.equal(configuredProfile.layout.scale, 0.82);

const invalidOverrideProfile = resolveLive2DRuntimeProfile({
  config: {
    capabilities: { pointerLook: true },
    parameters: {
      lookX: { id: 'MissingLookX' },
      lookY: { enabled: false },
      eyeLookX: { enabled: false },
      eyeLookY: { enabled: false },
    },
    profileVersion: 1,
  },
  coreModel: createCoreModel(['ParamAngleX']),
});
assert.equal(invalidOverrideProfile.parameters.lookX.id, null, 'an explicit ID override must not silently fall back');
assert.equal(invalidOverrideProfile.capabilities.pointerLook, false, 'unsupported enabled capabilities must degrade');

assert.deepEqual(
  normalizeLive2DRuntimeProfileConfig({
    layout: {
      offsetX: 99,
      scale: 0,
    },
    parameters: {
      lookX: {
        id: '  ParamAngleX  ',
        sensitivity: 99,
      },
    },
    profileVersion: 1,
  }),
  {
    layout: {
      offsetX: 2,
      scale: 0.1,
    },
    parameters: {
      lookX: {
        id: 'ParamAngleX',
        sensitivity: 4,
      },
    },
    profileVersion: 1,
  },
);
assert.equal(normalizeLive2DRuntimeProfileConfig({ profileVersion: 2 }), null);

console.log('live2d runtime profile smoke passed');
