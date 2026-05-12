import { describe, expect, it } from 'vitest';
import { KeystrokeInteractionCollectingService } from '../../../src/application/services/KeystrokeInteractionCollectingService';
import type { LiveInteractionEventEntity } from '../../../src/domain/live/entities/LiveInteractionEventEntity';
import type { LiveInteractionDomEventEntity } from '../../../src/domain/live/entities/LiveInteractionTargetEntity';

describe('KeystrokeInteractionCollectingService', () => {
  it('captures long pauses between most keystrokes as an instructed-user pattern', () => {
    const context = createContext();

    [0, 900, 1800, 2700, 3600].forEach((time) => {
      context.now = time;
      context.keyDown({ key: '1', isTrusted: true, target: { name: 'recipientAccount' } });
    });

    expect(context.events).toEqual([
      expect.objectContaining({
        atMs: 3600,
        kind: 'keystroke_anomaly_observed',
        metadata: expect.objectContaining({
          longPauseCount: 4,
          reason: 'long_keystroke_pause_instruction_pattern',
        }),
      }),
    ]);
  });

  it('captures uniform keystroke intervals as an automation pattern', () => {
    const context = createContext();

    [0, 100, 200, 300, 400].forEach((time) => {
      context.now = time;
      context.keyDown({ key: '1', isTrusted: true });
    });

    expect(context.events).toEqual([
      expect.objectContaining({
        atMs: 400,
        kind: 'keystroke_anomaly_observed',
        metadata: expect.objectContaining({
          reason: 'uniform_keystroke_interval_automation',
        }),
      }),
    ]);
  });

  it('captures short key hold times as a non-human typing pattern', () => {
    const context = createContext();

    [
      [0, 20],
      [150, 170],
      [300, 320],
      [450, 470],
    ].forEach(([downAtMs, upAtMs]) => {
      context.now = downAtMs;
      context.keyDown({ key: '1', isTrusted: true });
      context.now = upAtMs;
      context.keyUp({ key: '1', isTrusted: true });
    });

    expect(context.events).toEqual([
      expect.objectContaining({
        atMs: 470,
        kind: 'keystroke_anomaly_observed',
        metadata: expect.objectContaining({
          reason: 'short_key_hold_time_automation',
        }),
      }),
    ]);
  });

  it('captures ngram mismatches against the user typing profile', () => {
    const context = createContext({
      expectedNgrams: ['se', 'ec', 'cu', 'ur'],
    });

    'money'.split('').forEach((key, index) => {
      context.now = index * 90;
      context.keyDown({ key, isTrusted: true });
    });

    expect(context.events).toEqual([
      expect.objectContaining({
        atMs: 360,
        kind: 'keystroke_anomaly_observed',
        metadata: expect.objectContaining({
          reason: 'ngram_profile_mismatch',
          sampleCount: 4,
        }),
      }),
    ]);
  });

  it('captures Selenium SendKeys-style untrusted key events as a blocking signature', () => {
    const context = createContext();

    context.keyDown({ key: '1', isTrusted: false });

    expect(context.events).toEqual([
      {
        atMs: 0,
        kind: 'keystroke_anomaly_observed',
        metadata: {
          reason: 'selenium_sendkeys_signature',
        },
      },
    ]);
  });

  it('captures bimodal inter-key timing when two operators alternate typing cadence', () => {
    const context = createContext();

    [0, 90, 990, 1085, 2005, 2105, 3015].forEach((time) => {
      context.now = time;
      context.keyDown({ key: '1', isTrusted: true });
    });

    expect(context.events).toEqual([
      expect.objectContaining({
        atMs: 3015,
        kind: 'keystroke_anomaly_observed',
        metadata: expect.objectContaining({
          reason: 'bimodal_inter_key_timing',
        }),
      }),
    ]);
  });

  it('monitors long recipient typing without corrections only for correction-expected targets', () => {
    const context = createContext();
    const recipientTarget = { name: 'recipientName', value: '' };

    'SecurityName'.split('').forEach((digit, index) => {
      context.now = index * 70;
      recipientTarget.value += digit;
      context.keyDown({ key: digit, isTrusted: true, target: recipientTarget });
    });

    expect(context.events).toEqual([
      {
        atMs: 770,
        kind: 'keystroke_anomaly_observed',
        metadata: {
          keyCount: 12,
          reason: 'missing_typing_corrections',
        },
      },
    ]);
  });

  it('does not flag numeric recipient typing without corrections', () => {
    const context = createContext({ correctionExpected: false });
    const recipientTarget = { name: 'recipientAccount', value: '' };

    '408178100000'.split('').forEach((digit, index) => {
      context.now = index * 70;
      recipientTarget.value += digit;
      context.keyDown({ key: digit, isTrusted: true, target: recipientTarget });
    });

    expect(context.events).toEqual([]);
  });
});

function createContext(options: { correctionExpected?: boolean; expectedNgrams?: string[] } = {}) {
  const service = new KeystrokeInteractionCollectingService();
  const state = service.createState();
  const events: LiveInteractionEventEntity[] = [];
  const context = {
    events,
    now: 0,
    keyDown(event: LiveInteractionDomEventEntity) {
      service.recordKeyDown({
        isCorrectionExpectedTarget: () => options.correctionExpected ?? true,
        keystrokeExpectedNgrams: options.expectedNgrams,
        now: () => context.now,
        onEvent: (nextEvent) => events.push(nextEvent),
      }, state, event);
    },
    keyUp(event: LiveInteractionDomEventEntity) {
      service.recordKeyUp({
        isCorrectionExpectedTarget: () => options.correctionExpected ?? true,
        keystrokeExpectedNgrams: options.expectedNgrams,
        now: () => context.now,
        onEvent: (nextEvent) => events.push(nextEvent),
      }, state, event);
    },
  };
  return context;
}
