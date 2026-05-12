# @deepcode/antifraud-scenario-catalog

Parser, query helpers, and validation utilities for the DeepCode Antifraud PRD scenario catalog.

Use this package to read Markdown scenario tables into typed catalog objects that can drive tests, demos, or scenario recognition.

## Install

```sh
npm install @deepcode/antifraud-scenario-catalog --registry http://antifraud.deep-code.ai/verdaccio/
```

For scoped installs, add this to `.npmrc`:

```ini
@deepcode:registry=http://antifraud.deep-code.ai/verdaccio/
```

## Quick Start

```ts
import {
  ScenarioCatalogParsingService,
  ScenarioCatalogQueryingService,
  ScenarioCatalogValidatingService,
} from '@deepcode/antifraud-scenario-catalog';

const markdown = await fs.promises.readFile('prd/Scenarios_Catalog_v0.3.md', 'utf8');

const catalog = new ScenarioCatalogParsingService().parse(markdown);
const validation = new ScenarioCatalogValidatingService().validate(catalog);
const scenario = new ScenarioCatalogQueryingService().getScenarioById(catalog, 'CPR-001');

console.log(validation.valid, scenario?.factor);
```

## Main Exports

- `ScenarioCatalogParsingService` parses Markdown scenario tables.
- `ScenarioCatalogValidatingService` checks expected counts, duplicate IDs, missing IDs, and unknown groups.
- `ScenarioCatalogQueryingService` looks up scenarios and groups.
- `ScenarioIdBuildingService`, `ScenarioVerdictNormalizingService`, and `MarkdownTableRowParsingService`.
- `SCENARIO_GROUPS` and public catalog entity/value-object types.

## Parsed Output

The parser returns `ParsedScenarioCatalogEntity` with:

- `scenarios`: individual TP/TN/EDGE/COMP scenarios.
- `composites`: composite scenarios.
- `groups`: known factor groups from `SCENARIO_GROUPS`.
