import type { OnnxModelDefinitionEntity } from '../../domain/entities/OnnxModelDefinitionEntity';

export class OnnxModelRegisteringService {
  list(): OnnxModelDefinitionEntity[] {
    return [
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
    ];
  }
}
