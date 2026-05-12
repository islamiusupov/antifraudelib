# @deepcode/antifraud-ml

Lazy-loaded ML-style classifiers and ONNX model metadata for DeepCode Antifraud.

Use this package when you need local classifiers for phishing URL patterns or keystroke dynamics and want their output as standard DeepCode risk signals.

## Install

```sh
npm install @deepcode/antifraud-ml --registry http://antifraud.deep-code.ai/verdaccio/
```

For scoped installs, add this to `.npmrc`:

```ini
@deepcode:registry=http://antifraud.deep-code.ai/verdaccio/
```

## Quick Start

```ts
import {
  KeystrokeDynamicsClassifyingService,
  PhishingUrlClassifyingService,
} from '@deepcode/antifraud-ml';

const keystrokeSignal = new KeystrokeDynamicsClassifyingService().classify({
  intervalsMs: [92, 88, 640, 74, 69],
  baselineMedianMs: 90,
});

const phishingSignal = new PhishingUrlClassifyingService().classify({
  url: 'https://secure-bank.example-login.test/transfer',
  allowedDomains: ['bank.example'],
});

console.log(keystrokeSignal, phishingSignal);
```

## Main Exports

- `KeystrokeDynamicsClassifyingService` builds and scores keystroke timing signals.
- `PhishingUrlClassifyingService` builds and scores URL phishing signals.
- Feature vector builders and model scoring services for both classifiers.
- `OnnxModelRegisteringService` and model definition types.
- Packaged model assets under `models/`.

## Output

Classifiers return `RiskSignalEntity` values from `@deepcode/antifraud-core`, so they can be passed through `FactorContributionBuildingService` and `RiskScoringService`.
