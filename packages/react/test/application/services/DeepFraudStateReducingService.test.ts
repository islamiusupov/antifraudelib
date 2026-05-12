import { describe, expect, it } from 'vitest';
import { DeepFraudStateReducingService } from '../../../src/application/services/DeepFraudStateReducingService';

describe('DeepFraudStateReducingService', () => {
  it('creates initial state with an allow assessment', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [],
    });

    expect(state.userId).toBe('user-1');
    expect(state.consent).toBe('behavioral');
    expect(state.assessment.score).toBe(0);
    expect(state.assessment.decision.level).toBe('allow');
  });

  it('evaluates factors using core scoring', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        {
          kind: 'copy_paste_recipient',
          contribution: 40,
          maxContribution: 40,
          status: 'ok',
          reasonCodes: ['copy_paste_recipient'],
        },
        {
          kind: 'new_recipient',
          contribution: 25,
          maxContribution: 25,
          status: 'ok',
          reasonCodes: ['new_recipient_in_cooldown'],
        },
      ],
    });

    expect(state.assessment.score).toBe(65);
    expect(state.assessment.decision.level).toBe('step_up');
  });

  it('replaces scoped factors and keeps root identity', () => {
    const service = new DeepFraudStateReducingService();
    const initialState = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [],
    });

    const state = service.replaceScopeFactors(initialState, 'transaction', [
      {
        kind: 'phishing_text_dom',
        contribution: 60,
        maxContribution: 60,
        status: 'ok',
        reasonCodes: ['social_engineering_text'],
      },
    ]);

    expect(state.userId).toBe('user-1');
    expect(state.assessment.score).toBe(60);
    expect(state.assessment.decision.level).toBe('step_up');
    expect(state.factors).toHaveLength(1);
  });
});
