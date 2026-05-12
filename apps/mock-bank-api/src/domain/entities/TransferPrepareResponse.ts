export type TransferPrepareResponse = {
  draftId: string;
  status: 'RISK_EVALUATED';
  riskDecision: {
    decisionId: string;
    score: number;
    tier: 'ALLOW' | 'MONITOR' | 'STEP_UP' | 'BLOCK';
    recommendedChallenge: string | null;
    reasons: string[];
    latencyMs: number;
    modelVersion: string;
  };
};
