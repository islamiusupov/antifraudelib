export type FactorEvaluationRequest = {
  transactionId: string;
  userId: string;
  scenarioId?: string;
  factors: Array<{
    kind: string;
    [key: string]: unknown;
  }>;
};
