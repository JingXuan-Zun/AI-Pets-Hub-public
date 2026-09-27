export type PetRuntimePosition = {
  x: number;
  y: number;
};

export type PetRuntimeActivityArea = {
  width: number;
  height: number;
};

export interface PetRuntimeRenderState<TAction extends string> {
  action: TAction;
  motionTarget: PetRuntimePosition | null;
  position: PetRuntimePosition;
}
