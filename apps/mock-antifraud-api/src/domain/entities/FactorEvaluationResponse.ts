export type FactorEvaluationResponse = {
  transactionId: string;
  elapsedMs: number;
  evaluations: FactorResult[];
};

export type FactorResult = {
  kind: string;
  status: 'ok' | 'unknown_factor' | 'timeout' | 'error' | 'insufficient_data';
  contribution: number;
  maxContribution: number;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
};
