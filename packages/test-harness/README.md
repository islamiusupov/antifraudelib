# @deepcode/antifraud-test-harness

Scenario trace builder and recognizer for DeepCode Antifraud D-bank tests.

Use this package to turn parsed catalog scenarios into executable D-bank action traces, then recognize risk factors and composite scenarios from observed action traces.

## Install

```sh
npm install @deepcode/antifraud-test-harness --registry http://antifraud.deep-code.ai/verdaccio/
```

For scoped installs, add this to `.npmrc`:

```ini
@deepcode:registry=http://antifraud.deep-code.ai/verdaccio/
```

## Quick Start

```ts
import { ScenarioCatalogParsingService } from '@deepcode/antifraud-scenario-catalog';
import {
  BankActionScenarioRecognizingService,
  ScenarioTraceBuildingService,
} from '@deepcode/antifraud-test-harness';

const catalog = new ScenarioCatalogParsingService().parse(markdown);
const scenario = catalog.scenarios.find((item) => item.id === 'CPR-001');

if (scenario) {
  const actions = new ScenarioTraceBuildingService().build(scenario);
  const result = new BankActionScenarioRecognizingService().recognize(actions, catalog);

  console.log(result.status, result.riskSignals);
}
```

## Main Exports

- `ScenarioTraceBuildingService` builds D-bank action traces for individual catalog scenarios.
- `CompositeScenarioTraceBuildingService` builds action traces for composite scenarios.
- `BankActionScenarioRecognizingService` recognizes risk factors from action traces.
- `CompositeScenarioRecognizingService` matches composite scenarios.
- Types for bank actions, recognitions, recognition results, and statuses.

## Package Role

This package is intended for automated QA, scenario validation, and executable demos. It depends on `@deepcode/antifraud-core`, `@deepcode/antifraud-dbank-adapter`, and `@deepcode/antifraud-scenario-catalog`.
