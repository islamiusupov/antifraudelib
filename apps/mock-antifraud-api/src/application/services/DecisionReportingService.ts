import type { AntifraudDecisionReport } from '../../domain/entities/AntifraudDecisionReport';
import type { DecisionReportResult } from '../../domain/entities/DecisionReportResult';

export class DecisionReportingService {
  report(decisionReport: AntifraudDecisionReport): DecisionReportResult {
    if (!decisionReport.transactionId) {
      throw new Error('Decision report requires transactionId.');
    }
    if (!decisionReport.userId) {
      throw new Error('Decision report requires userId.');
    }
    if (decisionReport.decision.score < 0 || decisionReport.decision.score > 100) {
      throw new Error('Decision score must be between 0 and 100.');
    }

    return {
      accepted: true,
      status: 202,
    };
  }
}
