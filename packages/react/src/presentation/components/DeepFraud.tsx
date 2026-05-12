import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { useDeepFraud } from '../hooks/useDeepFraud';

export type DeepFraudProps = {
  scope: RiskScope;
  factors: RiskFactorEntity[];
  children: ReactNode;
};

export function DeepFraud({ scope, factors, children }: DeepFraudProps) {
  const { replaceScopeFactors } = useDeepFraud();

  useEffect(() => {
    replaceScopeFactors(scope, factors);
  }, [factors, replaceScopeFactors, scope]);

  return <>{children}</>;
}
