import type { DeepFraudConsent } from '../value-objects/DeepFraudConsent';

export type BotDetectionCollectionConfigEntity = {
  consent: DeepFraudConsent;
  botDetectionOptions?: Record<string, unknown>;
};
