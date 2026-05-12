import type { DecisionLevel } from '../value-objects/DecisionLevel';

export type AntifraudDecisionReportEntity = {
  transactionId: string;
  userId: string;
  decision: {
    level: DecisionLevel;
    score: number;
    reasons: Array<{
      code: string;
      contribution: number;
    }>;
    timestamp: string;
    sdkVersion?: string;
  };
};
