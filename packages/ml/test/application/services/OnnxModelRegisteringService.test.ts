import { describe, expect, it } from 'vitest';
import { OnnxModelRegisteringService } from '../../../src/application/services/OnnxModelRegisteringService';

describe('OnnxModelRegisteringService', () => {
  it('registers lazy ONNX model metadata for PRD ML factors', () => {
    const service = new OnnxModelRegisteringService();

    expect(service.list()).toEqual([
      {
        kind: 'keystroke_dynamics',
        runtime: 'onnx',
        assetPath: '/models/keystroke-dynamics.onnx',
        lazy: true,
        fallback: 'scaled_manhattan',
      },
      {
        kind: 'phishing_url',
        runtime: 'onnx',
        assetPath: '/models/urlbert-tiny-v4.onnx',
        lazy: true,
        fallback: 'url_pattern',
      },
    ]);
  });
});
