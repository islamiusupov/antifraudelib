# @deepcode/antifraud-core

Framework-agnostic risk scoring primitives for DeepCode Antifraud.

Use this package when you need to turn risk signals or factors into a normalized risk assessment without React, D-bank, or browser-specific collectors.

## Install

```sh
npm install @deepcode/antifraud-core --registry http://antifraud.deep-code.ai/verdaccio/
```

For scoped installs, add this to `.npmrc`:

```ini
@deepcode:registry=http://antifraud.deep-code.ai/verdaccio/
```

## Quick Start

```ts
import {
  FactorContributionBuildingService,
  RiskScoringService,
} from '@deepcode/antifraud-core';

const contributionBuilder = new FactorContributionBuildingService();
const scoring = new RiskScoringService();

const factors = contributionBuilder.buildMany([
  {
    kind: 'copy_paste_recipient',
    detected: true,
    confidence: 1,
    reasonCodes: ['copy_paste_recipient'],
    source: 'live',
  },
  {
    kind: 'new_recipient',
    detected: true,
    confidence: 1,
    reasonCodes: ['new_recipient_in_flow'],
    source: 'server',
  },
]);

const assessment = scoring.score({
  scope: 'transaction',
  factors,
});

console.log(assessment.score, assessment.decision.level);
```

## Main Exports

- `RiskScoringService` calculates score, factor contributions, reasons, and decision level.
- `FactorContributionBuildingService` converts `RiskSignalEntity` objects into scoreable factors.
- `RiskThresholdResolvingService` resolves scores into decision levels.
- `ServerFactorEvaluationAdaptingService` adapts server-side factor responses into risk factors.
- `RISK_FACTOR_DEFINITIONS`, `DEFAULT_RISK_DECISION_THRESHOLDS`, `DEFAULT_AGGREGATION_LIMIT`.
- Public TypeScript types for risk factors, signals, assessments, reasons, scopes, sources, tiers, and decisions.

## Package Role

This is the base dependency for the other DeepCode Antifraud packages. It contains no UI and no browser runtime side effects.
