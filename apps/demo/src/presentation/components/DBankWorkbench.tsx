import { useEffect, useMemo, useState } from 'react';
import { DBankBridgeMessageParsingService, type DBankObservedEventEntity } from '@deepcode/antifraud-dbank-adapter';
import { DecisionBadge, DeepFraud, DeepFraudRoot, ReasonCodeList, RiskMeter } from '@deepcode/antifraud-react';
import { DBankEventRiskFactorsBuildingService } from '../../application/services/DBankEventRiskFactorsBuildingService';
import type { DemoWorkbenchConfigEntity } from '../../domain/entities/DemoWorkbenchConfigEntity';

export type DBankWorkbenchProps = {
  config: DemoWorkbenchConfigEntity;
};

export function DBankWorkbench({ config }: DBankWorkbenchProps) {
  const dBankBridgeMessageParsingService = useMemo(() => new DBankBridgeMessageParsingService(), []);
  const dBankEventRiskFactorsBuildingService = useMemo(() => new DBankEventRiskFactorsBuildingService(), []);
  const [observedEvents, setObservedEvents] = useState<DBankObservedEventEntity[]>([]);
  const observedFactors = useMemo(
    () => dBankEventRiskFactorsBuildingService.build(observedEvents),
    [dBankEventRiskFactorsBuildingService, observedEvents],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = dBankBridgeMessageParsingService.parse(event.data);
      if (message === null) return;
      setObservedEvents((currentEvents) => [...currentEvents, message.payload]);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dBankBridgeMessageParsingService]);

  return (
    <DeepFraudRoot userId={config.userId} consent={config.consent} initialFactors={config.initialFactors}>
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
        <aside className="deepfraud-demo-workbench__result" data-dbank-event-count={observedEvents.length}>
          <RiskMeter />
          <DecisionBadge />
          <ReasonCodeList />
        </aside>
      </main>
    </DeepFraudRoot>
  );
}
