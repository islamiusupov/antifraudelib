import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { DeepFraudStateReducingService } from '../../application/services/DeepFraudStateReducingService';
import { SessionSignalCollectingService } from '../../application/services/SessionSignalCollectingService';
import type { DeepFraudConsent } from '../../domain/value-objects/DeepFraudConsent';
import { DeepFraudContext } from '../context/DeepFraudContext';

export type DeepFraudRootProps = {
  userId: string;
  consent: DeepFraudConsent;
  initialFactors?: RiskFactorEntity[];
  collectDeviceFingerprint?: boolean;
  collectBotDetection?: boolean;
  thumbmarkOptions?: Record<string, unknown>;
  botDetectionOptions?: Record<string, unknown>;
  children: ReactNode;
};

export function DeepFraudRoot({
  userId,
  consent,
  initialFactors,
  collectDeviceFingerprint = true,
  collectBotDetection = true,
  thumbmarkOptions,
  botDetectionOptions,
  children,
}: DeepFraudRootProps) {
  const stateReducingService = useMemo(() => new DeepFraudStateReducingService(), []);
  const sessionSignalCollectingService = useMemo(() => new SessionSignalCollectingService(), []);
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
  useEffect(() => {
    let isMounted = true;

    void sessionSignalCollectingService
      .collect({
        consent,
        collectDeviceFingerprint,
        collectBotDetection,
        thumbmarkOptions,
        botDetectionOptions,
      })
      .then((sessionFactors) => {
        if (isMounted) replaceScopeFactors('session', sessionFactors);
      });

    return () => {
      isMounted = false;
    };
  }, [
    botDetectionOptions,
    collectBotDetection,
    collectDeviceFingerprint,
    consent,
    replaceScopeFactors,
    sessionSignalCollectingService,
    thumbmarkOptions,
  ]);
  const contextValue = useMemo(
    () => ({
      ...state,
      replaceScopeFactors,
    }),
    [replaceScopeFactors, state],
  );

  return <DeepFraudContext.Provider value={contextValue}>{children}</DeepFraudContext.Provider>;
}
