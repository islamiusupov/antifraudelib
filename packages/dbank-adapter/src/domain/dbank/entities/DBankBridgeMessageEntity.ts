import type { DBankObservedEventEntity } from './DBankObservedEventEntity';

export type DBankBridgeMessageEntity = {
  source: 'd-bank';
  type: 'd-bank:event';
  payload: DBankObservedEventEntity;
};
