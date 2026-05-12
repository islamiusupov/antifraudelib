import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { BrowserApiInterceptionInstallingService } from '../../application/services/BrowserApiInterceptionInstallingService';
import { BrowserApiRiskFactorBuildingService } from '../../application/services/BrowserApiRiskFactorBuildingService';
import { ClientEnvironmentInspectingService } from '../../application/services/ClientEnvironmentInspectingService';
import { DeepFraudStateReducingService } from '../../application/services/DeepFraudStateReducingService';
import { LiveInteractionCollectingService } from '../../application/services/LiveInteractionCollectingService';
import { LiveInteractionRiskFactorBuildingService } from '../../application/services/LiveInteractionRiskFactorBuildingService';
import { RiskAssessmentNotifyingService } from '../../application/services/RiskAssessmentNotifyingService';
import { SessionSignalCollectingService } from '../../application/services/SessionSignalCollectingService';
import type { BrowserApiInterceptionEventEntity } from '../../domain/browser/entities/BrowserApiInterceptionEventEntity';
import type { LiveInteractionEventEntity } from '../../domain/live/entities/LiveInteractionEventEntity';
import type { RiskAssessmentNotificationCallbacksEntity } from '../../domain/common/entities/RiskAssessmentNotificationCallbacksEntity';
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
  collectLiveInteractions?: boolean;
  inspectClientEnvironment?: boolean;
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
  collectLiveInteractions = true,
  inspectClientEnvironment = true,
  browserApiAllowedUrls,
  onScore,
  onDecision,
  children,
}: DeepFraudRootProps) {
  const stateReducingService = useMemo(() => new DeepFraudStateReducingService(), []);
  const sessionSignalCollectingService = useMemo(() => new SessionSignalCollectingService(), []);
  const browserApiInterceptionInstallingService = useMemo(() => new BrowserApiInterceptionInstallingService(), []);
  const browserApiRiskFactorBuildingService = useMemo(() => new BrowserApiRiskFactorBuildingService(), []);
  const liveInteractionCollectingService = useMemo(() => new LiveInteractionCollectingService(), []);
  const liveInteractionRiskFactorBuildingService = useMemo(() => new LiveInteractionRiskFactorBuildingService(), []);
  const clientEnvironmentInspectingService = useMemo(() => new ClientEnvironmentInspectingService(), []);
  const riskAssessmentNotifyingService = useMemo(() => new RiskAssessmentNotifyingService(), []);
  const previousNotificationKey = useRef<string | undefined>(undefined);
  const [sessionCollectorFactors, setSessionCollectorFactors] = useState<RiskFactorEntity[]>([]);
  const [browserApiEvents, setBrowserApiEvents] = useState<BrowserApiInterceptionEventEntity[]>([]);
  const [liveInteractionEvents, setLiveInteractionEvents] = useState<LiveInteractionEventEntity[]>([]);
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
    () => [
      ...sessionCollectorFactors,
      ...browserApiFactors,
      ...liveInteractionRiskFactorBuildingService.build(liveInteractionEvents),
    ],
    [browserApiFactors, liveInteractionEvents, liveInteractionRiskFactorBuildingService, sessionCollectorFactors],
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
    if (!collectLiveInteractions) return undefined;

    return liveInteractionCollectingService.install({
      onEvent: (event) => setLiveInteractionEvents((currentEvents) => [...currentEvents, event]),
    });
  }, [collectLiveInteractions, liveInteractionCollectingService]);
  useEffect(() => {
    if (!inspectClientEnvironment) return;
    const events = clientEnvironmentInspectingService.inspect();
    if (events.length > 0) {
      setLiveInteractionEvents((currentEvents) => [...currentEvents, ...events]);
    }
  }, [clientEnvironmentInspectingService, inspectClientEnvironment]);
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
