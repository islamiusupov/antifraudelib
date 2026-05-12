import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { DeepFraudStateReducingService } from '../../application/services/DeepFraudStateReducingService';
import type { DeepFraudConsent } from '../../domain/value-objects/DeepFraudConsent';
import { DeepFraudContext } from '../context/DeepFraudContext';

export type DeepFraudRootProps = {
  userId: string;
  consent: DeepFraudConsent;
  initialFactors?: RiskFactorEntity[];
  children: ReactNode;
};

export function DeepFraudRoot({ userId, consent, initialFactors, children }: DeepFraudRootProps) {
  const stateReducingService = useMemo(() => new DeepFraudStateReducingService(), []);
  const [state, setState] = useState(() =>
    stateReducingService.createInitialState({
      userId,
      consent,
      factors: initialFactors,
    }),
  );
  const replaceScopeFactors = useCallback(
    (scope: RiskScope, factors: RiskFactorEntity[]) => {
      setState((currentState) => stateReducingService.replaceScopeFactors(currentState, scope, factors));
    },
    [stateReducingService],
  );
  const contextValue = useMemo(
    () => ({
      ...state,
      replaceScopeFactors,
    }),
    [replaceScopeFactors, state],
  );

  return <DeepFraudContext.Provider value={contextValue}>{children}</DeepFraudContext.Provider>;
}
