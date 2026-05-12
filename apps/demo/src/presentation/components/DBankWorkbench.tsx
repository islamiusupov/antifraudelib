import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DBankBridgeMessageParsingService, type DBankObservedEventEntity } from '@deepcode/antifraud-dbank-adapter';
import {
  DecisionBadge,
  DeepFraud,
  DeepFraudRoot,
  BrowserApiInterceptionInstallingService,
  BrowserApiRiskFactorBuildingService,
  LiveInteractionCollectingService,
  LiveInteractionRiskFactorBuildingService,
  ReasonCodeList,
  RiskFactorList,
  RiskMeter,
  VisualChallengeGate,
  type BrowserApiInterceptionEventEntity,
  type BrowserApiInterceptionTargetEntity,
  type LiveInteractionEventEntity,
  type LiveInteractionTargetEntity,
} from '@deepcode/antifraud-react';
import { DBankEventRiskFactorsBuildingService } from '../../application/services/DBankEventRiskFactorsBuildingService';
import type { DemoWorkbenchConfigEntity } from '../../domain/demo/entities/DemoWorkbenchConfigEntity';

const DEMO_SIGNAL_TTL_MS = 30000;

type TimedEventEntity<TEvent> = {
  event: TEvent;
  receivedAtMs: number;
};

export type DBankWorkbenchProps = {
  config: DemoWorkbenchConfigEntity;
};

export function DBankWorkbench({ config }: DBankWorkbenchProps) {
  const dBankBridgeMessageParsingService = useMemo(() => new DBankBridgeMessageParsingService(), []);
  const dBankEventRiskFactorsBuildingService = useMemo(() => new DBankEventRiskFactorsBuildingService(), []);
  const browserApiInterceptionInstallingService = useMemo(() => new BrowserApiInterceptionInstallingService(), []);
  const browserApiRiskFactorBuildingService = useMemo(() => new BrowserApiRiskFactorBuildingService(), []);
  const liveInteractionCollectingService = useMemo(() => new LiveInteractionCollectingService(), []);
  const liveInteractionRiskFactorBuildingService = useMemo(() => new LiveInteractionRiskFactorBuildingService(), []);
  const iframeCollectorCleanup = useRef<(() => void) | undefined>(undefined);
  const [observedEvents, setObservedEvents] = useState<Array<TimedEventEntity<DBankObservedEventEntity>>>([]);
  const [iframeBrowserApiEvents, setIframeBrowserApiEvents] = useState<Array<TimedEventEntity<BrowserApiInterceptionEventEntity>>>([]);
  const [iframeLiveEvents, setIframeLiveEvents] = useState<Array<TimedEventEntity<LiveInteractionEventEntity>>>([]);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const activeObservedEvents = useMemo(
    () => activeEvents(observedEvents, clockMs, DEMO_SIGNAL_TTL_MS),
    [clockMs, observedEvents],
  );
  const activeIframeLiveEvents = useMemo(
    () => activeEvents(iframeLiveEvents, clockMs, DEMO_SIGNAL_TTL_MS),
    [clockMs, iframeLiveEvents],
  );
  const activeIframeBrowserApiEvents = useMemo(
    () => activeEvents(iframeBrowserApiEvents, clockMs, DEMO_SIGNAL_TTL_MS),
    [clockMs, iframeBrowserApiEvents],
  );
  const observedFactors = useMemo(
    () => [
      ...dBankEventRiskFactorsBuildingService.build(activeObservedEvents),
      ...liveInteractionRiskFactorBuildingService.build(activeIframeLiveEvents),
      ...browserApiRiskFactorBuildingService.build(activeIframeBrowserApiEvents),
    ],
    [
      activeIframeBrowserApiEvents,
      activeIframeLiveEvents,
      activeObservedEvents,
      browserApiRiskFactorBuildingService,
      dBankEventRiskFactorsBuildingService,
      liveInteractionRiskFactorBuildingService,
    ],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = dBankBridgeMessageParsingService.parse(event.data);
      if (message === null) return;
      setObservedEvents((currentEvents) => [...currentEvents, timedEvent(message.payload)]);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dBankBridgeMessageParsingService]);
  useEffect(() => {
    const interval = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => () => iframeCollectorCleanup.current?.(), []);

  const installIframeCollector = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      iframeCollectorCleanup.current?.();
      iframeCollectorCleanup.current = undefined;
      setIframeBrowserApiEvents([]);
      setIframeLiveEvents([]);

      const liveTarget = thisFrameLiveTarget(iframe);
      const browserTarget = thisFrameBrowserTarget(iframe);
      const cleanups: Array<() => void> = [];
      if (liveTarget !== undefined) {
        cleanups.push(
          liveInteractionCollectingService.install({
            target: liveTarget,
            fastKeyIntervalMs: 80,
            rapidScrollWindowMs: 900,
            rapidScrollMinimumEvents: 3,
            onEvent: (event) => setIframeLiveEvents((currentEvents) => [...currentEvents, timedEvent(event)]),
          }),
        );
      }
      if (browserTarget !== undefined) {
        cleanups.push(
          browserApiInterceptionInstallingService.install({
            target: browserTarget,
            onEvent: (event) => setIframeBrowserApiEvents((currentEvents) => [...currentEvents, timedEvent(event)]),
          }),
        );
      }
      iframeCollectorCleanup.current = () => {
        cleanups.reverse().forEach((cleanup) => cleanup());
      };
    },
    [browserApiInterceptionInstallingService, liveInteractionCollectingService],
  );

  return (
    <DeepFraudRoot
      userId={config.userId}
      consent={config.consent}
      initialFactors={config.initialFactors}
      collectSpeechTranscripts
    >
      <main
        className="deepfraud-demo-workbench"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          minHeight: '100vh',
        }}
      >
        <section className="deepfraud-demo-workbench__bank">
          <DeepFraud scope="transaction" factors={observedFactors}>
            <iframe
              title="D-bank demo"
              src={config.dBank.iframePath}
              onLoad={(event) => installIframeCollector(event.currentTarget)}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              style={{
                border: 0,
                display: 'block',
                height: '100vh',
                width: '100%',
              }}
            />
          </DeepFraud>
        </section>
        <aside className="deepfraud-demo-workbench__result" data-dbank-event-count={activeObservedEvents.length}>
          <RiskMeter />
          <DecisionBadge />
          <VisualChallengeGate autoRequest includeAudio />
          <RiskFactorList />
          <ReasonCodeList />
        </aside>
      </main>
    </DeepFraudRoot>
  );
}

function timedEvent<TEvent>(event: TEvent): TimedEventEntity<TEvent> {
  return {
    event,
    receivedAtMs: Date.now(),
  };
}

function activeEvents<TEvent>(
  events: Array<TimedEventEntity<TEvent>>,
  clockMs: number,
  ttlMs: number,
): TEvent[] {
  return events
    .filter((event) => clockMs - event.receivedAtMs <= ttlMs)
    .map((event) => event.event);
}

function thisFrameLiveTarget(iframe: HTMLIFrameElement | null): LiveInteractionTargetEntity | undefined {
  try {
    const frameWindow = iframe?.contentWindow;
    const frameDocument = frameWindow?.document;
    if (frameWindow === undefined || frameWindow === null || frameDocument === undefined) return undefined;

    const frameRecord = frameWindow as unknown as Record<string, unknown>;

    return {
      document: frameDocument as unknown as LiveInteractionTargetEntity['document'],
      window: frameWindow as unknown as LiveInteractionTargetEntity['window'],
      MutationObserver: frameRecord.MutationObserver as LiveInteractionTargetEntity['MutationObserver'],
    };
  } catch {
    return undefined;
  }
}

function thisFrameBrowserTarget(iframe: HTMLIFrameElement | null): BrowserApiInterceptionTargetEntity | undefined {
  try {
    const frameWindow = iframe?.contentWindow;
    if (frameWindow === undefined || frameWindow === null) return undefined;

    return frameWindow as unknown as BrowserApiInterceptionTargetEntity;
  } catch {
    return undefined;
  }
}
