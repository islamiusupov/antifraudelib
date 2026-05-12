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

  it('blocks COMP-18 new recipient with copy-paste and concurrent media using a composite boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['new_recipient_copy_paste_concurrent_media_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(100);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('keeps copy-paste with concurrent media below block when the recipient is not new', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
      ],
    });

    const hasCompositeBoost = state.factors.some(
      (currentFactor) => currentFactor.kind === 'composite_risk_boost',
    );

    expect(hasCompositeBoost).toBe(false);
    expect(state.assessment.score).toBe(75);
    expect(state.assessment.decision.level).toBe('step_up');
  });

  it('blocks COMP-19 new recipient with phishing text and skipped warning', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
        factor('phishing_text_dom', 60, 60, ['phishing_text_dom']),
        factor('warning_dwell', 20, 20, ['warning_skipped']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['new_recipient_phishing_warning_skip_composite'],
        }),
      ]),
    );
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

  it('blocks PGV-18 frequent page exits with concurrent media and copy-paste', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('page_visibility', 20, 25, ['frequent_page_exits_during_payment_form']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
        factor('copy_paste_amount', 20, 20, ['copy_paste_amount']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['page_exits_media_copy_paste_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('steps up PGV-19 frequent page exits with keystroke pauses', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('page_visibility', 25, 25, ['frequent_page_exits_during_payment_form']),
        factor('keystroke_dynamics', 30, 30, ['long_keystroke_pause_instruction_pattern']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['page_exits_keystroke_pause_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(65);
    expect(state.assessment.decision.level).toBe('step_up');
  });

  it('blocks PGV-20 long absence with new recipient and phishing text', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('page_visibility', 25, 25, ['long_absence_fast_action_sequence'], { hiddenDurationMs: 310000 }),
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
        factor('phishing_text_dom', 60, 60, ['phishing_text_dom']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['long_absence_new_recipient_phishing_composite'],
        }),
      ]),
    );
    expect(state.assessment.decision.level).toBe('block');
  });

  it('steps up WDW-01 fast warning confirmation with the warning step-up boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('warning_dwell', 18, 20, ['warning_dwell_too_short']),
        factor('composite_risk_boost', 42, 42, ['warning_skip_step_up_floor']),
      ],
    });

    expect(state.assessment.score).toBe(60);
    expect(state.assessment.decision.level).toBe('step_up');
  });

  it('blocks WDW-03 three fast warning skips with the warning series boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('warning_dwell', 20, 20, ['warning_skip_series_three_fast_confirmations']),
        factor('composite_risk_boost', 65, 65, ['warning_skip_series_block_floor']),
      ],
    });

    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('steps up KST-01 through KST-03 and KST-05/KST-07/KST-08 with a keystroke floor boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 30, 30, ['uniform_keystroke_interval_automation']),
        factor('composite_risk_boost', 30, 30, ['keystroke_step_up_floor']),
      ],
    });

    expect(state.assessment.score).toBe(60);
    expect(state.assessment.decision.level).toBe('step_up');
  });

  it('blocks KST-06 Selenium SendKeys signatures with a keystroke block floor', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 30, 30, ['selenium_sendkeys_signature']),
        factor('composite_risk_boost', 55, 55, ['keystroke_block_floor']),
      ],
    });

    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('monitors KST-04 missing typing corrections without a boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 30, 30, ['missing_typing_corrections']),
      ],
    });

    expect(state.assessment.score).toBe(30);
    expect(state.assessment.decision.level).toBe('monitor');
  });

  it.each([
    'baseline_insufficient_new_user',
    'input_method_split_baseline',
    'keyboard_layout_changed_ngram_set',
  ])('monitors KST-11/KST-14/KST-15 %s without a step-up boost', (reasonCode) => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 30, 30, [reasonCode]),
      ],
    });

    expect(state.assessment.score).toBe(30);
    expect(state.assessment.decision.level).toBe('monitor');
  });

  it('blocks KST-18 keystroke anomaly with concurrent media and frequent page exits', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 24, 30, ['keystroke_dynamics_anomaly']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
        factor('page_visibility', 20, 25, ['page_visibility_oscillation']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 10,
          reasonCodes: ['keystroke_concurrent_media_page_exits_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(89);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('steps up KST-19 keystroke anomaly with copy-paste and no manual input', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 24, 30, ['keystroke_dynamics_anomaly']),
        factor('copy_paste_amount', 20, 20, ['copy_paste_amount'], { manualKeyCount: 0 }),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 20,
          reasonCodes: ['keystroke_copy_paste_no_manual_input_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(64);
    expect(state.assessment.decision.level).toBe('step_up');
  });

  it('blocks KST-20 keystroke anomaly on a first-time device', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 24, 30, ['keystroke_dynamics_anomaly']),
        factor('device_fingerprint', 30, 30, ['first_time_device'], { firstSeenDevice: true }),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 35,
          reasonCodes: ['keystroke_first_time_device_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(89);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PURL-17 phishing URL with phishing DOM text', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('phishing_url', 40, 40, ['phishing_url_typosquat_bank_brand']),
        factor('phishing_text_dom', 60, 60, ['phishing_text_dom']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 45,
          reasonCodes: ['phishing_url_text_composite'],
        }),
      ]),
    );
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PURL-18 phishing URL with copy-paste recipient', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('phishing_url', 40, 40, ['phishing_url_typosquat_bank_brand']),
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 45,
          reasonCodes: ['phishing_url_copy_paste_recipient_composite'],
        }),
      ]),
    );
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PURL-19 phishing URL with concurrent media', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('phishing_url', 40, 40, ['phishing_url_typosquat_bank_brand']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 45,
          reasonCodes: ['phishing_url_concurrent_media_composite'],
        }),
      ]),
    );
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PURL-20 new recipient added through a phishing URL', () => {
    const service = new DeepFraudStateReducingService();
    const sourceUrl = 'https://sberbank-online-secure.shop';

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('phishing_url', 40, 40, ['phishing_url_typosquat_bank_brand'], { url: sourceUrl }),
        factor('new_recipient', 25, 25, ['new_recipient_in_flow'], {
          sourceFactor: 'phishing_url',
          sourceUrl,
        }),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 45,
          reasonCodes: ['phishing_url_new_recipient_source_composite'],
        }),
      ]),
    );
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks DVT-17 DevTools JS paste with a new recipient', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('dev_environment', 15, 15, ['devtools_console_long_js_paste']),
        factor('composite_risk_boost', 45, 45, ['devtools_step_up_floor']),
        factor('new_recipient', 25, 25, ['new_recipient_in_flow']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          reasonCodes: expect.arrayContaining(['devtools_js_paste_new_recipient_composite']),
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks DVT-18 DevTools with WebDriver automated harvesting', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('dev_environment', 15, 15, ['devtools_console_external_log_activity']),
        factor('bot_detection', 50, 50, ['webdriver_enabled']),
        factor('composite_risk_boost', 35, 35, ['devtools_bot_block_floor']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          reasonCodes: expect.arrayContaining(['devtools_webdriver_harvesting_composite']),
        }),
      ]),
    );
    expect(state.assessment.score).toBe(100);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks DVT-19 DevTools with concurrent media and warning skip', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('dev_environment', 15, 15, ['devtools_opened_during_payment_form']),
        factor('composite_risk_boost', 45, 45, ['devtools_step_up_floor']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
        factor('warning_dwell', 20, 20, ['warning_dwell_too_short']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          reasonCodes: expect.arrayContaining(['devtools_media_warning_skip_composite']),
        }),
      ]),
    );
    expect(state.assessment.score).toBe(100);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks DVT-20 DevTools with phishing text in console output', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('dev_environment', 15, 15, ['devtools_console_external_log_activity']),
        factor('composite_risk_boost', 45, 45, ['devtools_step_up_floor']),
        factor('phishing_text_dom', 60, 60, ['phishing_text_dom'], { source: 'console_output' }),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          reasonCodes: expect.arrayContaining(['devtools_console_phishing_output_composite']),
        }),
      ]),
    );
    expect(state.assessment.score).toBe(100);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PTR-17 pointer anomaly with native tampering using a composite boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('pointer_pattern', 20, 20, ['pointer_tremor_false_positive_risk']),
        factor('native_tampering', 40, 40, ['native_tampering']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 25,
          reasonCodes: ['pointer_native_tampering_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PTR-18 pointer anomaly with bot detection using a composite boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('pointer_pattern', 20, 20, ['pointer_idle_drift_missing']),
        factor('bot_detection', 50, 50, ['bot_detection']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 15,
          reasonCodes: ['pointer_bot_detection_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PTR-19 pointer anomaly with screen sharing heuristics using a composite boost', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('pointer_pattern', 20, 20, ['pointer_idle_drift_missing']),
        factor('client_environment', 12, 15, ['screen_sharing_heuristic']),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 53,
          reasonCodes: ['pointer_screen_sharing_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('blocks PTR-20 pointer anomaly with fast reading-form completion metadata', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('pointer_pattern', 20, 20, ['pointer_linear_rat_autofill'], {
          formDurationMs: 4200,
          formRequiresReading: true,
        }),
      ],
    });

    expect(state.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 65,
          reasonCodes: ['pointer_fast_form_completion_composite'],
        }),
      ]),
    );
    expect(state.assessment.score).toBe(85);
    expect(state.assessment.decision.level).toBe('block');
  });

  it('does not add a KST composite boost when a composite boost already exists', () => {
    const service = new DeepFraudStateReducingService();

    const state = service.createInitialState({
      userId: 'user-1',
      consent: 'behavioral',
      factors: [
        factor('keystroke_dynamics', 30, 30, ['one_hand_typing_pattern']),
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient'], { manualKeyCount: 0 }),
        factor('composite_risk_boost', 30, 30, ['keystroke_step_up_floor']),
      ],
    });

    expect(state.factors.filter((currentFactor) => currentFactor.kind === 'composite_risk_boost')).toHaveLength(1);
  });
});

function factor(
  kind: string,
  contribution: number,
  maxContribution: number,
  reasonCodes: string[],
  metadata?: Record<string, unknown>,
) {
  return {
    kind,
    contribution,
    maxContribution,
    status: 'ok' as const,
    source: 'live' as const,
    reasonCodes,
    ...(metadata !== undefined ? { metadata } : {}),
  };
}
