import { describe, expect, it, vi } from 'vitest';
import { RiskAssessmentNotifyingService } from '../../../src/application/services/RiskAssessmentNotifyingService';

describe('RiskAssessmentNotifyingService', () => {
  it('notifies score and decision callbacks for a new assessment', () => {
    const service = new RiskAssessmentNotifyingService();
    const onScore = vi.fn();
    const onDecision = vi.fn();
    const assessment = assessmentFixture(65, 'step_up');

    const key = service.notify(assessment, { onScore, onDecision });

    expect(key).toBe(service.buildNotificationKey(assessment));
    expect(onScore).toHaveBeenCalledWith(assessment);
    expect(onDecision).toHaveBeenCalledWith(assessment.decision, assessment);
  });

  it('does not notify duplicate assessment keys', () => {
    const service = new RiskAssessmentNotifyingService();
    const onScore = vi.fn();
    const onDecision = vi.fn();
    const assessment = assessmentFixture(35, 'monitor');
    const previousKey = service.buildNotificationKey(assessment);

    expect(service.notify(assessment, { onScore, onDecision }, previousKey)).toBe(previousKey);
    expect(onScore).not.toHaveBeenCalled();
    expect(onDecision).not.toHaveBeenCalled();
  });
});

function assessmentFixture(score: number, level: 'allow' | 'monitor' | 'step_up' | 'block') {
  return {
    scope: 'transaction' as const,
    score,
    decision: {
      level,
      reasons: [
        {
          factorKind: 'copy_paste_recipient',
          code: 'copy_paste_recipient',
          contribution: 40,
        },
      ],
    },
    factorContributions: [
      {
        kind: 'copy_paste_recipient',
        status: 'ok' as const,
        contribution: 40,
        maxContribution: 40,
        reasonCodes: ['copy_paste_recipient'],
      },
    ],
  };
}
