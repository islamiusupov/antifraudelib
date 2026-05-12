import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { BrowserApiInterceptionInstallingService } from '../../application/services/BrowserApiInterceptionInstallingService';
import { BrowserApiRiskFactorBuildingService } from '../../application/services/BrowserApiRiskFactorBuildingService';
import { DeepFraudStateReducingService } from '../../application/services/DeepFraudStateReducingService';
import { RiskAssessmentNotifyingService } from '../../application/services/RiskAssessmentNotifyingService';
import { SessionSignalCollectingService } from '../../application/services/SessionSignalCollectingService';
import type { BrowserApiInterceptionEventEntity } from '../../domain/entities/BrowserApiInterceptionEventEntity';
import type { RiskAssessmentNotificationCallbacksEntity } from '../../domain/entities/RiskAssessmentNotificationCallbacksEntity';
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
  interceptBrowserApis?: boolean;
  browserApiAllowedUrls?: Array<string | RegExp>;
  onScore?: RiskAssessmentNotificationCallbacksEntity['onScore'];
  onDecision?: RiskAssessmentNotificationCallbacksEntity['onDecision'];
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
  interceptBrowserApis = true,
  browserApiAllowedUrls,
  onScore,
  onDecision,
  children,
}: DeepFraudRootProps) {
  const stateReducingService = useMemo(() => new DeepFraudStateReducingService(), []);
  const sessionSignalCollectingService = useMemo(() => new SessionSignalCollectingService(), []);
  const browserApiInterceptionInstallingService = useMemo(() => new BrowserApiInterceptionInstallingService(), []);
  const browserApiRiskFactorBuildingService = useMemo(() => new BrowserApiRiskFactorBuildingService(), []);
  const riskAssessmentNotifyingService = useMemo(() => new RiskAssessmentNotifyingService(), []);
  const previousNotificationKey = useRef<string | undefined>(undefined);
  const [sessionCollectorFactors, setSessionCollectorFactors] = useState<RiskFactorEntity[]>([]);
  const [browserApiEvents, setBrowserApiEvents] = useState<BrowserApiInterceptionEventEntity[]>([]);
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
  const browserApiFactors = useMemo(
    () => browserApiRiskFactorBuildingService.build(browserApiEvents),
    [browserApiEvents, browserApiRiskFactorBuildingService],
  );
  const sessionFactors = useMemo(
    () => [...sessionCollectorFactors, ...browserApiFactors],
    [browserApiFactors, sessionCollectorFactors],
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
        if (isMounted) setSessionCollectorFactors(sessionFactors);
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
  useEffect(() => {
    if (!interceptBrowserApis) return undefined;

    return browserApiInterceptionInstallingService.install({
      allowedUrls: browserApiAllowedUrls,
      onEvent: (event) => setBrowserApiEvents((currentEvents) => [...currentEvents, event]),
    });
  }, [browserApiAllowedUrls, browserApiInterceptionInstallingService, interceptBrowserApis]);
  useEffect(() => {
    replaceScopeFactors('session', sessionFactors);
  }, [replaceScopeFactors, sessionFactors]);
  useEffect(() => {
    previousNotificationKey.current = riskAssessmentNotifyingService.notify(
      state.assessment,
      {
        onScore,
        onDecision,
      },
      previousNotificationKey.current,
    );
  }, [onDecision, onScore, riskAssessmentNotifyingService, state.assessment]);
  const contextValue = useMemo(
    () => ({
      ...state,
      replaceScopeFactors,
    }),
    [replaceScopeFactors, state],
  );

  return <DeepFraudContext.Provider value={contextValue}>{children}</DeepFraudContext.Provider>;
}
