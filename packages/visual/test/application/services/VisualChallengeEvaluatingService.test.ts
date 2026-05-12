import { describe, expect, it } from 'vitest';
import { VisualChallengeEvaluatingService } from '../../../src/application/services/VisualChallengeEvaluatingService';

describe('VisualChallengeEvaluatingService', () => {
  it('passes when exactly one face and liveness checks pass', () => {
    const service = new VisualChallengeEvaluatingService();

    expect(
      service.evaluate({
        cameraPermission: 'granted',
        faceCount: 1,
        blinkDetected: true,
        movementDetected: true,
      }),
    ).toEqual({
      result: 'pass',
      reasonCodes: [],
      riskSignal: undefined,
    });
  });

  it('blocks shoulder surfing when two or more faces are detected', () => {
    const service = new VisualChallengeEvaluatingService();

    expect(
      service.evaluate({
        cameraPermission: 'granted',
        faceCount: 2,
        blinkDetected: true,
        movementDetected: true,
      }),
    ).toEqual({
      result: 'block',
      reasonCodes: ['shoulder_surfing_detected'],
      riskSignal: {
        kind: 'visual_challenge',
        detected: true,
        confidence: 1,
        reasonCodes: ['shoulder_surfing_detected'],
        source: 'live',
      },
    });
  });

  it('blocks when no user is present', () => {
    const service = new VisualChallengeEvaluatingService();

    expect(
      service.evaluate({
        cameraPermission: 'granted',
        faceCount: 0,
        blinkDetected: false,
        movementDetected: false,
      }).reasonCodes,
    ).toEqual(['user_not_present']);
  });

  it('falls back to recall question when camera permission is denied', () => {
    const service = new VisualChallengeEvaluatingService();

    expect(
      service.evaluate({
        cameraPermission: 'denied',
      }),
    ).toEqual({
      result: 'fallback',
      reasonCodes: ['camera_permission_denied'],
      riskSignal: {
        kind: 'visual_challenge',
        detected: true,
        confidence: 0.2,
        reasonCodes: ['camera_permission_denied'],
        source: 'live',
      },
    });
  });
});
