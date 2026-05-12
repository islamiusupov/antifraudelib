import { DecisionBadge, DeepFraud, DeepFraudRoot, ReasonCodeList, RiskMeter } from '@deepcode/antifraud-react';
import type { DemoWorkbenchConfigEntity } from '../../domain/entities/DemoWorkbenchConfigEntity';

export type DBankWorkbenchProps = {
  config: DemoWorkbenchConfigEntity;
};

export function DBankWorkbench({ config }: DBankWorkbenchProps) {
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
          <DeepFraud scope="transaction" factors={[]}>
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
        <aside className="deepfraud-demo-workbench__result">
          <RiskMeter />
          <DecisionBadge />
          <ReasonCodeList />
        </aside>
      </main>
    </DeepFraudRoot>
  );
}
