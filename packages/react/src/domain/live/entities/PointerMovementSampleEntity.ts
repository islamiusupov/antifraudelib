export type PointerMovementSampleEntity = {
  x: number;
  y: number;
  atMs: number;
  pointerType?: string;
  inputDeviceType?: string;
  buttons?: number;
  movementX?: number;
  movementY?: number;
  targetText?: string;
  targetRect?: PointerTargetRectEntity;
  isTrusted?: boolean;
};

export type PointerTargetRectEntity = {
  left: number;
  top: number;
  width: number;
  height: number;
};
