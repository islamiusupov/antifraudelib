import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { OnnxModelRegisteringService } from '../../../src/application/services/OnnxModelRegisteringService';

describe('OnnxModelRegisteringService', () => {
  it('registers lazy ONNX model metadata for PRD ML factors', () => {
    const service = new OnnxModelRegisteringService();

    expect(service.list()).toEqual([
      {
        kind: 'keystroke_dynamics',
        runtime: 'onnx',
        assetPath: '/models/keystroke-dynamics.onnx',
        packageAssetPath: 'models/keystroke-dynamics.onnx',
        inputName: 'features',
        outputName: 'probability',
        inputShape: [1, 3],
        lazy: true,
        fallback: 'scaled_manhattan',
      },
      {
        kind: 'phishing_url',
        runtime: 'onnx',
        assetPath: '/models/urlbert-tiny-v4.onnx',
        packageAssetPath: 'models/urlbert-tiny-v4.onnx',
        inputName: 'features',
        outputName: 'probability',
        inputShape: [1, 9],
        lazy: true,
        fallback: 'url_pattern',
      },
    ]);
  });

  it('points every registered model to a package ONNX asset', () => {
    const service = new OnnxModelRegisteringService();

    service.list().forEach((definition) => {
      const modelPath = join(process.cwd(), 'packages', 'ml', definition.packageAssetPath);
      expect(existsSync(modelPath)).toBe(true);
      expect(statSync(modelPath).size).toBeGreaterThan(100);
    });
  });
});
