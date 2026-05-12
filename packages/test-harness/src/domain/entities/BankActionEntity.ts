import type { BankActionKind } from '../value-objects/BankActionKind';

export type BankActionEntity = {
  kind: BankActionKind;
  atMs: number;
  metadata?: Record<string, unknown>;
};
