import { SERVER_SIDE_FACTOR_KINDS } from '../../domain/constants/ServerSideFactorKinds';
import type { FactorEvaluationRequestEntity } from '../../domain/antifraud/entities/FactorEvaluationRequestEntity';
import type { FactorEvaluationResponseEntity, FactorResultEntity } from '../../domain/antifraud/entities/FactorEvaluationResponseEntity';

export class AntifraudFactorsEvaluatingService {
  evaluate(request: FactorEvaluationRequestEntity): FactorEvaluationResponseEntity {
    return {
      transactionId: request.transactionId,
      elapsedMs: 42,
      evaluations: request.factors.map((factor) => this.evaluateFactor(factor.kind, request.scenarioId)),
    };
  }

  private evaluateFactor(kind: string, scenarioId?: string): FactorResultEntity {
    if (!SERVER_SIDE_FACTOR_KINDS.includes(kind as never)) {
      return {
        kind,
        status: 'unknown_factor',
        contribution: 0,
        maxContribution: 0,
        reasonCodes: [],
      };
    }

    const scenarioContribution = this.scenarioContribution(kind, scenarioId);
    return {
      kind,
      status: 'ok',
      contribution: scenarioContribution.contribution,
      maxContribution: scenarioContribution.maxContribution,
      reasonCodes: scenarioContribution.reasonCodes,
      metadata: scenarioContribution.metadata,
    };
  }

  private scenarioContribution(
    kind: string,
    scenarioId?: string,
  ): Pick<FactorResultEntity, 'contribution' | 'maxContribution' | 'reasonCodes' | 'metadata'> {
    if (scenarioId === 'seip_safe_account' || scenarioId === 'C1') {
      if (kind === 'new_recipient') {
        return {
          contribution: 25,
          maxContribution: 25,
          reasonCodes: ['new_recipient_in_cooldown', 'first_tx_to_recipient'],
          metadata: { recipientAgeHours: 0.5, txCountToRecipient: 0 },
        };
      }
      if (kind === 'amount_anomaly') {
        return {
          contribution: 28,
          maxContribution: 30,
          reasonCodes: ['amount_above_p95'],
          metadata: { userP95Amount: 4500, actualAmount: 87000 },
        };
      }
      if (kind === 'recipient_account_age') {
        return {
          contribution: 20,
          maxContribution: 20,
          reasonCodes: ['recipient_account_under_30_days'],
          metadata: { accountAgeDays: 8 },
        };
      }
    }

    return {
      contribution: 0,
      maxContribution: this.defaultMaxContribution(kind),
      reasonCodes: [],
      metadata: {},
    };
  }

  private defaultMaxContribution(kind: string): number {
    const maxContributions: Record<string, number> = {
      new_recipient: 25,
      amount_anomaly: 30,
      time_of_day_anomaly: 20,
      velocity_anomaly: 25,
      recipient_velocity: 35,
      recipient_account_age: 20,
      geoip_jump: 30,
      time_since_login: 15,
      tls_fingerprint: 30,
      request_idempotency_breach: 25,
      recent_password_change: 35,
      recent_contact_change: 30,
      device_id_per_user_ratio: 50,
      shared_recipient_graph: 35,
      parallel_session: 40,
      incoming_call_correlation: 40,
    };
    return maxContributions[kind] ?? 0;
  }
}
