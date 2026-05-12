import type { RiskFactorEntity } from '@deepcode/antifraud-core';
import type { DeepFraudConsent } from '../../value-objects/DeepFraudConsent';

export type DeepFraudRootConfigEntity = {
  userId: string;
  consent: DeepFraudConsent;
  factors?: RiskFactorEntity[];
};
