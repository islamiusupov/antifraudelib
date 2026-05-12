import type { DBankStaticAssetsLocation } from '@deepcode/antifraud-dbank-adapter';
import type { RiskFactorEntity } from '@deepcode/antifraud-core';
import type { DeepFraudConsent } from '@deepcode/antifraud-react';

export type DemoWorkbenchConfigEntity = {
  userId: string;
  consent: DeepFraudConsent;
  dBank: DBankStaticAssetsLocation;
  initialFactors: RiskFactorEntity[];
};
