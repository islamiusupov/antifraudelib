import type { RiskFactorKind } from '@deepcode/antifraud-core';
import type { MlFallbackKind } from '../value-objects/MlFallbackKind';
import type { MlRuntimeKind } from '../value-objects/MlRuntimeKind';

export type OnnxModelDefinitionEntity = {
  kind: RiskFactorKind;
  runtime: MlRuntimeKind;
  assetPath: string;
  packageAssetPath: string;
  inputName: string;
  outputName: string;
  inputShape: number[];
  lazy: boolean;
  fallback: MlFallbackKind;
};
