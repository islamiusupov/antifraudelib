# @deepcode/antifraud-react

React bindings, collectors, and UI components for DeepCode Antifraud.

Use this package to collect browser/session signals, maintain antifraud state, and render risk UI in a React application.

## Install

```sh
npm install @deepcode/antifraud-react @deepcode/antifraud-core --registry http://antifraud.deep-code.ai/verdaccio/
```

For scoped installs, add this to `.npmrc`:

```ini
@deepcode:registry=http://antifraud.deep-code.ai/verdaccio/
```

`react` is a peer dependency and must be provided by the host application.

## Quick Start

```tsx
import {
  DeepFraudRoot,
  RiskMeter,
  DecisionBadge,
  RiskFactorList,
} from '@deepcode/antifraud-react';

export function CheckoutRiskPanel() {
  return (
    <DeepFraudRoot
      userId="user-123"
      consent="behavioral"
      browserApiAllowedUrls={['https://api.bank.example/']}
      onDecision={(decision) => console.log(decision.level)}
    >
      <RiskMeter />
      <DecisionBadge />
      <RiskFactorList />
    </DeepFraudRoot>
  );
}
```

## Adding Transaction Factors

```tsx
import { DeepFraud } from '@deepcode/antifraud-react';

<DeepFraud
  scope="transaction"
  factors={[
    {
      kind: 'new_recipient',
      contribution: 25,
      maxContribution: 25,
      status: 'ok',
      source: 'server',
      reasonCodes: ['new_recipient_in_flow'],
    },
  ]}
>
  <TransferForm />
</DeepFraud>;
```

## Risk History

`RiskMeter` renders the current score and a time-based risk graph. By default it samples the current assessment every second and keeps a 60 second window.

```tsx
import { RiskMeter } from '@deepcode/antifraud-react';

<RiskMeter historyWindowMs={120000} sampleIntervalMs={1000} />;
```

You can also pass a controlled history when the host application already stores risk timeline data:

```tsx
<RiskMeter
  history={[
    { atMs: 0, score: 12, decisionLevel: 'allow' },
    { atMs: 30000, score: 48, decisionLevel: 'monitor' },
    { atMs: 60000, score: 82, decisionLevel: 'block' },
  ]}
  historyWindowMs={60000}
/>;
```

## Main Exports

- `DeepFraudRoot`, `DeepFraud`, and `useDeepFraud` for state and scoped factors.
- UI components: `RiskMeter`, `DecisionBadge`, `RiskFactorList`, `ReasonCodeList`, `VisualChallengeGate`.
- Collectors for live interactions, browser API interception, device fingerprinting, bot detection, speech transcripts, and client environment checks.
- Risk factor builders for browser, live interaction, bot, fingerprint, camera, and session signals.

## Runtime Notes

Browser collectors install event listeners and browser API wrappers while mounted. Disable collectors with props such as `collectLiveInteractions={false}`, `interceptBrowserApis={false}`, or `collectDeviceFingerprint={false}` when a host app needs explicit control.
