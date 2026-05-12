import type { PointerTargetRectEntity } from './PointerMovementSampleEntity';

export type PointerClickSampleEntity = {
  x: number;
  y: number;
  atMs: number;
  pointerType?: string;
  inputDeviceType?: string;
  durationMs?: number;
  targetText?: string;
  targetRect?: PointerTargetRectEntity;
  hoverSampleCount?: number;
  hoveredTargetCount?: number;
};
