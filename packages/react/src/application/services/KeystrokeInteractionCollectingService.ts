import type { LiveInteractionCollectingConfigEntity } from '../../domain/live/entities/LiveInteractionCollectingConfigEntity';
import type { LiveInteractionDomEventEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';

type KeystrokeTargetState = {
  correctionKeyCount: number;
  keyCount: number;
  missingCorrectionsEmitted?: boolean;
};

type KeystrokeInteractionCollectingState = {
  activeKeyDowns: Map<string, number[]>;
  emittedReasonCodes: Set<string>;
  fastKeyCount: number;
  holdDurations: number[];
  intervals: number[];
  previousCharacterKeyAtMs?: number;
  previousKeyAtMs?: number;
  targetStates: WeakMap<object, KeystrokeTargetState>;
};

export type KeystrokeInteractionCollectingConfig = Pick<
  LiveInteractionCollectingConfigEntity,
  'fastKeyIntervalMs' | 'now' | 'onEvent'
> & {
  isCorrectionExpectedTarget(target: unknown): boolean;
};

const DEFAULT_FAST_KEY_INTERVAL_MS = 60;
const KEYSTROKE_PATTERN_MINIMUM_INTERVALS = 4;
const KEYSTROKE_LONG_PAUSE_MINIMUM_MS = 800;
const KEYSTROKE_LONG_PAUSE_MAXIMUM_MS = 2000;
const KEYSTROKE_LONG_PAUSE_MINIMUM_RATIO = 0.6;
const KEYSTROKE_UNIFORM_INTERVAL_MS = 100;
const KEYSTROKE_UNIFORM_TOLERANCE_MS = 5;
const KEYSTROKE_SHORT_HOLD_MAXIMUM_MS = 30;
const KEYSTROKE_HOLD_MINIMUM_SAMPLES = 4;
const ERROR_FREE_TYPING_MINIMUM_KEYS = 12;
const KEYSTROKE_SAMPLE_LIMIT = 8;

export class KeystrokeInteractionCollectingService {
  createState(): KeystrokeInteractionCollectingState {
    return {
      activeKeyDowns: new Map(),
      emittedReasonCodes: new Set(),
      fastKeyCount: 0,
      holdDurations: [],
      intervals: [],
      targetStates: new WeakMap(),
    };
  }

  recordKeyDown(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
    event: LiveInteractionDomEventEntity,
  ): void {
    const atMs = this.now(config);
    if (event.isTrusted === false) {
      this.emitAnomaly(config, state, 'untrusted_key_event');
      return;
    }

    this.recordTargetTyping(config, state, event);
    this.recordCharacterKeyDown(config, state, event.key, atMs);
    this.detectFastKeyBurst(config, state, atMs);
  }

  recordKeyUp(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
    event: LiveInteractionDomEventEntity,
  ): void {
    if (!this.isCharacterKey(event.key)) return;
    const keyId = this.keystrokeKeyId(event.key);
    const keyDowns = state.activeKeyDowns.get(keyId) ?? [];
    const keyDownAtMs = keyDowns.shift();
    if (keyDownAtMs === undefined) return;
    if (keyDowns.length > 0) {
      state.activeKeyDowns.set(keyId, keyDowns);
    } else {
      state.activeKeyDowns.delete(keyId);
    }

    const holdDuration = this.now(config) - keyDownAtMs;
    if (holdDuration < 0) return;
    state.holdDurations = this.appendSample(state.holdDurations, holdDuration);
    if (
      state.holdDurations.length >= KEYSTROKE_HOLD_MINIMUM_SAMPLES &&
      state.holdDurations.every((duration) => duration < KEYSTROKE_SHORT_HOLD_MAXIMUM_MS)
    ) {
      this.emitAnomaly(config, state, 'short_key_hold_time_automation', {
        holdDurations: state.holdDurations,
      });
    }
  }

  private recordTargetTyping(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
    event: LiveInteractionDomEventEntity,
  ): void {
    if (!this.isTextInputKey(event.key) || event.target === null || typeof event.target !== 'object') return;
    const targetState = this.targetState(state, event.target);
    targetState.keyCount += 1;
    if (this.isCorrectionKey(event.key)) {
      targetState.correctionKeyCount += 1;
    }
    this.detectMissingTypingCorrections(config, targetState, event.target);
  }

  private recordCharacterKeyDown(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
    key: string | undefined,
    atMs: number,
  ): void {
    if (!this.isCharacterKey(key)) return;
    if (state.previousCharacterKeyAtMs !== undefined) {
      state.intervals = this.appendSample(state.intervals, atMs - state.previousCharacterKeyAtMs);
      this.detectLongKeystrokePauses(config, state);
      this.detectUniformKeystrokeIntervals(config, state);
    }
    state.previousCharacterKeyAtMs = atMs;
    const keyId = this.keystrokeKeyId(key);
    state.activeKeyDowns.set(keyId, [...(state.activeKeyDowns.get(keyId) ?? []), atMs]);
  }

  private detectFastKeyBurst(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
    atMs: number,
  ): void {
    if (
      state.previousKeyAtMs !== undefined &&
      atMs - state.previousKeyAtMs <= (config.fastKeyIntervalMs ?? DEFAULT_FAST_KEY_INTERVAL_MS)
    ) {
      state.fastKeyCount += 1;
    } else {
      state.fastKeyCount = 0;
    }
    state.previousKeyAtMs = atMs;
    if (state.fastKeyCount >= 3) {
      this.emitAnomaly(config, state, 'fast_key_burst');
    }
  }

  private detectLongKeystrokePauses(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
  ): void {
    if (state.intervals.length < KEYSTROKE_PATTERN_MINIMUM_INTERVALS) return;
    const longPauseCount = state.intervals.filter((interval) => (
      interval >= KEYSTROKE_LONG_PAUSE_MINIMUM_MS &&
      interval <= KEYSTROKE_LONG_PAUSE_MAXIMUM_MS
    )).length;
    if (longPauseCount / state.intervals.length < KEYSTROKE_LONG_PAUSE_MINIMUM_RATIO) return;
    this.emitAnomaly(config, state, 'long_keystroke_pause_instruction_pattern', {
      intervals: state.intervals,
      longPauseCount,
    });
  }

  private detectUniformKeystrokeIntervals(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
  ): void {
    if (state.intervals.length < KEYSTROKE_PATTERN_MINIMUM_INTERVALS) return;
    if (
      state.intervals.every((interval) => (
        Math.abs(interval - KEYSTROKE_UNIFORM_INTERVAL_MS) <= KEYSTROKE_UNIFORM_TOLERANCE_MS
      ))
    ) {
      this.emitAnomaly(config, state, 'uniform_keystroke_interval_automation', {
        intervals: state.intervals,
      });
    }
  }

  private detectMissingTypingCorrections(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeTargetState,
    target: unknown,
  ): void {
    if (state.missingCorrectionsEmitted === true) return;
    if (state.keyCount < ERROR_FREE_TYPING_MINIMUM_KEYS || state.correctionKeyCount > 0) return;
    if (!config.isCorrectionExpectedTarget(target)) return;
    state.missingCorrectionsEmitted = true;
    config.onEvent({
      kind: 'keystroke_anomaly_observed',
      atMs: this.now(config),
      metadata: {
        keyCount: state.keyCount,
        reason: 'missing_typing_corrections',
      },
    });
  }

  private emitAnomaly(
    config: KeystrokeInteractionCollectingConfig,
    state: KeystrokeInteractionCollectingState,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): void {
    if (state.emittedReasonCodes.has(reason)) return;
    state.emittedReasonCodes.add(reason);
    config.onEvent({
      kind: 'keystroke_anomaly_observed',
      atMs: this.now(config),
      metadata: {
        ...metadata,
        reason,
      },
    });
  }

  private targetState(state: KeystrokeInteractionCollectingState, target: object): KeystrokeTargetState {
    const existingState = state.targetStates.get(target);
    if (existingState !== undefined) return existingState;
    const nextState = {
      correctionKeyCount: 0,
      keyCount: 0,
    };
    state.targetStates.set(target, nextState);
    return nextState;
  }

  private appendSample(samples: number[], sample: number): number[] {
    return [...samples, sample].slice(-KEYSTROKE_SAMPLE_LIMIT);
  }

  private isTextInputKey(key: string | undefined): boolean {
    return key === undefined || key.length === 1 || key === 'Backspace' || key === 'Delete';
  }

  private isCharacterKey(key: string | undefined): boolean {
    return key === undefined || key.length === 1;
  }

  private isCorrectionKey(key: string | undefined): boolean {
    return key === 'Backspace' || key === 'Delete';
  }

  private keystrokeKeyId(key: string | undefined): string {
    return key ?? '__unknown_key__';
  }

  private now(config: Pick<KeystrokeInteractionCollectingConfig, 'now'>): number {
    return config.now?.() ?? Date.now();
  }
}
