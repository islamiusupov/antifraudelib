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

type TimedEventEntity<TEvent> = {
  event: TEvent;
  receivedAtMs: number;
};

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
  collectSpeechTranscripts?: boolean;
  liveSignalTtlMs?: number;
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
  collectSpeechTranscripts = false,
  liveSignalTtlMs = 30000,
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
  const [browserApiEvents, setBrowserApiEvents] = useState<Array<TimedEventEntity<BrowserApiInterceptionEventEntity>>>([]);
  const [liveInteractionEvents, setLiveInteractionEvents] = useState<Array<TimedEventEntity<LiveInteractionEventEntity>>>([]);
  const [clockMs, setClockMs] = useState(() => Date.now());
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
    () => browserApiRiskFactorBuildingService.build(thisActiveEvents(browserApiEvents, clockMs, liveSignalTtlMs)),
    [browserApiEvents, browserApiRiskFactorBuildingService, clockMs, liveSignalTtlMs],
  );
  const sessionFactors = useMemo(
    () => [
      ...sessionCollectorFactors,
      ...browserApiFactors,
      ...liveInteractionRiskFactorBuildingService.build(thisActiveEvents(liveInteractionEvents, clockMs, liveSignalTtlMs)),
    ],
    [browserApiFactors, clockMs, liveInteractionEvents, liveInteractionRiskFactorBuildingService, liveSignalTtlMs, sessionCollectorFactors],
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
      onEvent: (event) => setBrowserApiEvents((currentEvents) => [...currentEvents, thisTimedEvent(event)]),
    });
  }, [browserApiAllowedUrls, browserApiInterceptionInstallingService, interceptBrowserApis]);
  useEffect(() => {
    if (!collectLiveInteractions) return undefined;

    return liveInteractionCollectingService.install({
      collectSpeechTranscripts,
      onEvent: (event) => setLiveInteractionEvents((currentEvents) => [...currentEvents, thisTimedEvent(event)]),
    });
  }, [collectLiveInteractions, collectSpeechTranscripts, liveInteractionCollectingService]);
  useEffect(() => {
    if (!inspectClientEnvironment) return;
    const events = clientEnvironmentInspectingService.inspect();
    if (events.length > 0) {
      setLiveInteractionEvents((currentEvents) => [...currentEvents, ...events.map((event) => thisTimedEvent(event))]);
    }
  }, [clientEnvironmentInspectingService, inspectClientEnvironment]);
  useEffect(() => {
    if (liveSignalTtlMs <= 0) return undefined;
    const interval = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [liveSignalTtlMs]);
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

function thisTimedEvent<TEvent>(event: TEvent): TimedEventEntity<TEvent> {
  return {
    event,
    receivedAtMs: Date.now(),
  };
}

function thisActiveEvents<TEvent>(
  events: Array<TimedEventEntity<TEvent>>,
  clockMs: number,
  ttlMs: number,
): TEvent[] {
  if (ttlMs <= 0) return events.map((event) => event.event);
  return events
    .filter((event) => clockMs - event.receivedAtMs <= ttlMs)
    .map((event) => event.event);
}
