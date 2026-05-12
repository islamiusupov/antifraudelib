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
});
