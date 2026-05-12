import type { PointerClickSampleEntity } from './PointerClickSampleEntity';
import type { PointerMovementSampleEntity } from './PointerMovementSampleEntity';

export type PointerPatternAnalysisInputEntity = {
  movements: PointerMovementSampleEntity[];
  clicks?: PointerClickSampleEntity[];
  maxTouchPoints?: number;
  deviceType?: string;
  pointerJumpThresholdPx?: number;
  idleDriftMinimumGapMs?: number;
  formDurationMs?: number;
  formRequiresReading?: boolean;
};
