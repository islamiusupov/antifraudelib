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

  it('keeps root and every scope contribution when replacing one scope', () => {
    const service = new DeepFraudStateReducingService();
    const initialState = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        {
          kind: 'dev_environment',
          contribution: 15,
          maxContribution: 15,
          status: 'ok',
          reasonCodes: ['dev_environment'],
        },
      ],
    });

    const transactionState = service.replaceScopeFactors(initialState, 'transaction', [
      {
        kind: 'copy_paste_recipient',
        contribution: 40,
        maxContribution: 40,
        status: 'ok',
        reasonCodes: ['copy_paste_recipient'],
      },
    ]);
    const challengeState = service.replaceScopeFactors(transactionState, 'challenge', [
      {
        kind: 'visual_challenge',
        contribution: 50,
        maxContribution: 50,
        status: 'ok',
        reasonCodes: ['face_count_gt_one'],
      },
    ]);

    expect(challengeState.factors.map((factor) => factor.kind)).toEqual([
      'dev_environment',
      'copy_paste_recipient',
      'visual_challenge',
    ]);
    expect(challengeState.assessment.score).toBe(100);
    expect(challengeState.assessment.decision.level).toBe('block');
  });

  it('deduplicates the same risk factor across scopes and keeps unique reasons', () => {
    const service = new DeepFraudStateReducingService();
    const initialState = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [],
    });
    const sessionState = service.replaceScopeFactors(initialState, 'session', [
      {
        kind: 'page_visibility',
        contribution: 20,
        maxContribution: 25,
        status: 'ok',
        reasonCodes: ['page_visibility_oscillation'],
      },
    ]);

    const transactionState = service.replaceScopeFactors(sessionState, 'transaction', [
      {
        kind: 'page_visibility',
        contribution: 20,
        maxContribution: 25,
        status: 'ok',
        reasonCodes: ['page_visibility_oscillation'],
      },
      {
        kind: 'concurrent_media',
        contribution: 35,
        maxContribution: 35,
        status: 'ok',
        reasonCodes: ['layer2_media_request'],
      },
    ]);

    expect(transactionState.factors).toEqual([
      {
        kind: 'page_visibility',
        contribution: 20,
        maxContribution: 25,
        status: 'ok',
        reasonCodes: ['page_visibility_oscillation'],
      },
      {
        kind: 'concurrent_media',
        contribution: 35,
        maxContribution: 35,
        status: 'ok',
        reasonCodes: ['layer2_media_request'],
      },
    ]);
    expect(transactionState.assessment.score).toBe(55);
    expect(transactionState.assessment.decision.reasons.map((reason) => reason.code)).toEqual([
      'layer2_media_request',
      'page_visibility_oscillation',
    ]);
  });

  it('clears a scope when it is replaced with an empty factor list', () => {
    const service = new DeepFraudStateReducingService();
    const initialState = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [],
    });
    const riskyState = service.replaceScopeFactors(initialState, 'transaction', [
      {
        kind: 'copy_paste_recipient',
        contribution: 40,
        maxContribution: 40,
        status: 'ok',
        reasonCodes: ['copy_paste_recipient'],
      },
    ]);

    const clearedState = service.replaceScopeFactors(riskyState, 'transaction', []);

    expect(clearedState.factors).toEqual([]);
    expect(clearedState.scopedFactors.transaction).toEqual([]);
    expect(clearedState.assessment.score).toBe(0);
    expect(clearedState.assessment.decision.level).toBe('allow');
  });

  it('lowers the assessment when camera verification is added to the challenge scope', () => {
    const service = new DeepFraudStateReducingService();
    const initialState = service.createInitialState({
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
          reasonCodes: ['new_recipient_in_flow'],
        },
      ],
    });

    const verifiedState = service.replaceScopeFactors(initialState, 'challenge', [
      {
        kind: 'camera_verification',
        contribution: -20,
        maxContribution: 20,
        status: 'ok',
        reasonCodes: ['camera_verified'],
        source: 'live',
      },
    ]);

    expect(initialState.assessment.score).toBe(65);
    expect(initialState.assessment.decision.level).toBe('step_up');
    expect(verifiedState.assessment.score).toBe(45);
    expect(verifiedState.assessment.decision.level).toBe('monitor');
  });

  it('steps up when programmatic clipboard read is followed by recipient auto-fill', () => {
    const service = new DeepFraudStateReducingService();
    const initialState = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [],
    });
    const sessionState = service.replaceScopeFactors(initialState, 'session', [
      {
        kind: 'programmatic_clipboard_read',
        contribution: 20,
        maxContribution: 20,
        status: 'ok',
        reasonCodes: ['programmatic_clipboard_read'],
        source: 'live',
      },
    ]);
    const transactionState = service.replaceScopeFactors(sessionState, 'transaction', [
      {
        kind: 'copy_paste_recipient',
        contribution: 40,
        maxContribution: 40,
        status: 'ok',
        reasonCodes: ['copy_paste_recipient'],
        source: 'live',
      },
    ]);

    expect(transactionState.assessment.score).toBe(60);
    expect(transactionState.assessment.decision.level).toBe('step_up');
  });

  it('steps up NRC-03 current-session recipient with no previous use', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
        factor('composite_risk_boost', 35, 35, ['recipient_added_current_session_no_previous_use']),
      ],
    });

    expect(state.assessment.score).toBe(60);
    expect(state.assessment.decision.level).toBe('step_up');
  });

  it('monitors NRC-11 new recipient with a small test-payment pattern', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
        factor('composite_risk_boost', 5, 5, ['new_recipient_small_test_payment_pattern']),
      ],
    });

    expect(state.assessment.score).toBe(30);
    expect(state.assessment.decision.level).toBe('monitor');
  });

  it('blocks NRC-04 three new recipients with different amounts in one hour', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('new_recipient', 25, 25, ['new_recipient_layering_pattern']),
        factor('recipient_velocity', 35, 35, ['new_recipient_layering_pattern']),
        factor('velocity_anomaly', 25, 25, ['layering_different_amounts']),
      ],
    });

    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks COMP-17 copy-paste with new recipient and amount above history P95', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
        factor('amount_anomaly', 30, 30, ['amount_above_p95']),
      ],
    });

    expect(state.assessment.score).toBe(95);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks COMP-18 copy-paste with concurrent media using a composite boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['copy_paste_concurrent_media_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks COMP-19 copy-paste with phishing text for safe account wording', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
        factor('phishing_text_dom', 60, 60, ['phishing_text_dom']),
      ],
    });

    expect(state.assessment.score).toBe(100);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks COMP-20 new recipient with frequent page exits and top decile amount', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
        factor('page_visibility', 20, 25, ['page_visibility_oscillation']),
        factor('amount_anomaly', 30, 30, ['amount_top_decile']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['new_recipient_page_visibility_amount_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });
});

function factor(
  kind: string,
  contribution: number,
  maxContribution: number,
  reasonCodes: string[],
) {
  return {
    kind,
    contribution,
    maxContribution,
    status: 'ok' as const,
    source: 'live' as const,
    reasonCodes,
  };
}
