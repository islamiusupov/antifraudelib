import { describe, expect, it } from 'vitest';
import { VisualChallengeCameraRequestingService } from '../../../src/application/services/VisualChallengeCameraRequestingService';

describe('VisualChallengeCameraRequestingService', () => {
  it('requests camera and microphone when audio is enabled and stops granted tracks', async () => {
    const stoppedTracks: string[] = [];
    const requests: MediaStreamConstraints[] = [];
    const service = new VisualChallengeCameraRequestingService();

    const state = await service.request({
      includeAudio: true,
      requestCamera: async (constraints) => {
        requests.push(constraints);
        return stream([
          { id: 'video-1', stop: () => stoppedTracks.push('video-1') },
          { id: 'audio-1', stop: () => stoppedTracks.push('audio-1') },
        ]);
      },
    });

    expect(state).toBe('granted');
    expect(requests).toEqual([{ video: true, audio: true }]);
    expect(stoppedTracks).toEqual(['video-1', 'audio-1']);
  });

  it('requests only camera by default', async () => {
    const requests: MediaStreamConstraints[] = [];
    const service = new VisualChallengeCameraRequestingService();

    await service.request({
      requestCamera: async (constraints) => {
        requests.push(constraints);
        return stream([]);
      },
    });

    expect(requests).toEqual([{ video: true, audio: false }]);
  });

  it('returns denied when the media request fails', async () => {
    const service = new VisualChallengeCameraRequestingService();

    await expect(
      service.request({
        requestCamera: async () => {
          throw new Error('NotAllowedError');
        },
      }),
    ).resolves.toBe('denied');
  });

  it('returns unavailable when no browser media API or injected request exists', async () => {
    const service = new VisualChallengeCameraRequestingService();

    await expect(service.request()).resolves.toBe('unavailable');
  });
});

function stream(tracks: Array<{ stop(): void }>): MediaStream {
  return {
    getTracks: () => tracks as MediaStreamTrack[],
  } as MediaStream;
}
