export type FactorEvaluationResponseEntity = {
  transactionId: string;
  elapsedMs: number;
  evaluations: FactorResultEntity[];
};

export type FactorResultEntity = {
  kind: string;
  status: 'ok' | 'unknown_factor' | 'timeout' | 'error' | 'insufficient_data';
  contribution: number;
  maxContribution: number;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
};
