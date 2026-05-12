export type PointerPatternVerdictLevelEntity = 'allow' | 'monitor' | 'step_up';

export type PointerPatternVerdictEntity = {
  level: PointerPatternVerdictLevelEntity;
  reasonCode: string;
  reasonCodes: string[];
  confidence: number;
  metadata: Record<string, unknown>;
};
