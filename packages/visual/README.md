# @deepcode/antifraud-visual

Visual challenge evaluation primitives for DeepCode Antifraud.

Use this package to convert camera/liveness challenge observations into pass, fallback, or block decisions and optional risk signals.

## Install

```sh
npm install @deepcode/antifraud-visual --registry http://antifraud.deep-code.ai/verdaccio/
```

For scoped installs, add this to `.npmrc`:

```ini
@deepcode:registry=http://antifraud.deep-code.ai/verdaccio/
```

## Quick Start

```ts
import { VisualChallengeEvaluatingService } from '@deepcode/antifraud-visual';

const decision = new VisualChallengeEvaluatingService().evaluate({
  cameraPermission: 'granted',
  faceCount: 1,
  blinkDetected: true,
  movementDetected: true,
});

console.log(decision.result);
```

## Main Exports

- `VisualChallengeEvaluatingService` evaluates visual challenge frames.
- `VisualChallengeDecisionEntity` and `VisualChallengeFrameEntity` types.
- `CameraPermissionState` and `VisualChallengeResult` value-object types.

## Decision Behavior

- Returns `pass` when exactly one live user is present.
- Returns `fallback` when camera permission or face count is unavailable.
- Returns `block` for no face, multiple faces, or failed liveness checks.

When the result is `fallback` or `block`, the decision includes a `visual_challenge` risk signal compatible with `@deepcode/antifraud-core`.
