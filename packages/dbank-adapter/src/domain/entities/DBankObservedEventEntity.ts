import type { DBankObservedEventKind } from '../value-objects/DBankObservedEventKind';

export type DBankObservedEventEntity = {
  kind: DBankObservedEventKind;
  atMs: number;
  metadata?: Record<string, unknown>;
};
