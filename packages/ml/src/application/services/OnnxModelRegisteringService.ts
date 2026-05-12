import type { OnnxModelDefinitionEntity } from '../../domain/ml/entities/OnnxModelDefinitionEntity';

export class OnnxModelRegisteringService {
  list(): OnnxModelDefinitionEntity[] {
    return [
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
    ];
  }
}
