import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { VisualChallengeDecisionEntity } from '../../domain/entities/VisualChallengeDecisionEntity';
import type { VisualChallengeFrameEntity } from '../../domain/entities/VisualChallengeFrameEntity';

export class VisualChallengeEvaluatingService {
  evaluate(frame: VisualChallengeFrameEntity): VisualChallengeDecisionEntity {
    if (frame.cameraPermission === 'denied') {
      return this.fallback(['camera_permission_denied'], 0.2);
    }
    if (frame.faceCount === undefined) {
      return this.fallback(['face_count_unavailable'], 0.2);
    }
    if (frame.faceCount === 0) {
      return this.block(['user_not_present']);
    }
    if (frame.faceCount > 1) {
      return this.block(['shoulder_surfing_detected']);
    }
    if (frame.blinkDetected !== true || frame.movementDetected !== true) {
      return this.block(['face_liveness_failed']);
    }

    return {
      result: 'pass',
      reasonCodes: [],
      riskSignal: undefined,
    };
  }

  private block(reasonCodes: string[]): VisualChallengeDecisionEntity {
    return {
      result: 'block',
      reasonCodes,
      riskSignal: this.riskSignal(reasonCodes, 1),
    };
  }

  private fallback(reasonCodes: string[], confidence: number): VisualChallengeDecisionEntity {
    return {
      result: 'fallback',
      reasonCodes,
      riskSignal: this.riskSignal(reasonCodes, confidence),
    };
  }

  private riskSignal(reasonCodes: string[], confidence: number): RiskSignalEntity {
    return {
      kind: 'visual_challenge',
      detected: true,
      confidence,
      reasonCodes,
      source: 'live',
    };
  }
}
