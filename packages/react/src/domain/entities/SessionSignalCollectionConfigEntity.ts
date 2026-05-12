import type { DeepFraudConsent } from '../value-objects/DeepFraudConsent';

export type SessionSignalCollectionConfigEntity = {
  consent: DeepFraudConsent;
  collectDeviceFingerprint?: boolean;
  collectBotDetection?: boolean;
  thumbmarkOptions?: Record<string, unknown>;
  botDetectionOptions?: Record<string, unknown>;
};
