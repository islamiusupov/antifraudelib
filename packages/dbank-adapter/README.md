# @deepcode/antifraud-dbank-adapter

D-bank integration layer for DeepCode Antifraud.

Use this package to parse bridge messages emitted by the D-bank demo and convert observed D-bank events into DeepCode risk signals.

## Install

```sh
npm install @deepcode/antifraud-dbank-adapter --registry http://antifraud.deep-code.ai/verdaccio/
```

For scoped installs, add this to `.npmrc`:

```ini
@deepcode:registry=http://antifraud.deep-code.ai/verdaccio/
```

## Quick Start

```ts
import {
  DBankBridgeMessageParsingService,
  DBankLiveFactorExtractingService,
} from '@deepcode/antifraud-dbank-adapter';

const parser = new DBankBridgeMessageParsingService();
const extractor = new DBankLiveFactorExtractingService();

const message = parser.parse({
  source: 'd-bank',
  type: 'd-bank:event',
  payload: {
    kind: 'recipient_pasted',
    atMs: Date.now(),
  },
});

const signals = message === null ? [] : extractor.extract([message.payload]);

console.log(signals);
```

## Main Exports

- `DBankBridgeMessageParsingService` validates `postMessage` payloads from D-bank.
- `DBankLiveFactorExtractingService` maps D-bank events to risk signals.
- `DBankStaticAssetsLocatingService` resolves local D-bank static asset paths for demo tooling.
- Types for D-bank bridge messages, observed events, event kinds, and static asset locations.

## Recognized Event Examples

The adapter recognizes events such as `recipient_pasted`, `amount_pasted`, `recipient_created`, `media_active`, `warning_shown`, `warning_confirmed`, `form_fill_order_observed`, `page_hidden`, `page_visible`, `phishing_url_observed`, and `server_factor_observed`.
