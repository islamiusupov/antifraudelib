import type { LiveInteractionEventEntity } from './LiveInteractionEventEntity';
import type { LiveInteractionTargetEntity } from './LiveInteractionTargetEntity';

export type LiveInteractionCollectingConfigEntity = {
  onEvent(event: LiveInteractionEventEntity): void;
  target?: LiveInteractionTargetEntity;
  now?: () => number;
  pointerJumpThresholdPx?: number;
  fastKeyIntervalMs?: number;
};
