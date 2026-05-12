import type { VisualChallengeCameraState } from '../../domain/value-objects/VisualChallengeCameraState';

export type VisualChallengeMediaRequest = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

export type VisualChallengeCameraRequestingOptions = {
  includeAudio?: boolean;
  requestCamera?: VisualChallengeMediaRequest;
};

export class VisualChallengeCameraRequestingService {
  async request(options: VisualChallengeCameraRequestingOptions = {}): Promise<VisualChallengeCameraState> {
    const requestCamera = this.resolveCameraRequest(options.requestCamera);
    if (requestCamera === undefined) return 'unavailable';

    try {
      const stream = await requestCamera({
        video: true,
        audio: options.includeAudio === true,
      });
      stream.getTracks().forEach((track) => track.stop());
      return 'granted';
    } catch {
      return 'denied';
    }
  }

  private resolveCameraRequest(requestCamera?: VisualChallengeMediaRequest): VisualChallengeMediaRequest | undefined {
    if (requestCamera !== undefined) return requestCamera;
    if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia === undefined) {
      return undefined;
    }
    return (constraints) => navigator.mediaDevices.getUserMedia(constraints);
  }
}
