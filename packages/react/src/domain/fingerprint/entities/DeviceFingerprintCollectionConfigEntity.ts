import type { DeepFraudConsent } from '../../value-objects/DeepFraudConsent';

export type DeviceFingerprintCollectionConfigEntity = {
  consent: DeepFraudConsent;
  thumbmarkOptions?: Record<string, unknown>;
};
