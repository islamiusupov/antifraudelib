import { describe, expect, it, vi } from 'vitest';
import { DeviceFingerprintCollectingService } from '../../../src/application/services/DeviceFingerprintCollectingService';

describe('DeviceFingerprintCollectingService', () => {
  it('collects a SHA-256-ready ThumbmarkJS fingerprint when behavioral consent is present', async () => {
    const thumbmarkOptions: Record<string, unknown>[] = [];
    const loadThumbmark = vi.fn(async () => ({
      Thumbmark: class {
        constructor(options?: Record<string, unknown>) {
          thumbmarkOptions.push(options ?? {});
        }

        async get() {
          return {
            thumbmark: ' raw-thumbmark ',
            components: {
              canvas: 'canvas-hash',
              webgl: 'webgl-hash',
            },
          };
        }
      },
    }));
    const hashThumbmark = vi.fn(async (thumbmark: string) => `sha256:${thumbmark}`);
    const service = new DeviceFingerprintCollectingService({
      loadThumbmark,
      hashThumbmark,
      isBrowser: () => true,
    });

    await expect(
      service.collect({
        consent: 'behavioral',
        thumbmarkOptions: {
          timeout: 700,
        },
      }),
    ).resolves.toEqual({
      status: 'collected',
      provider: 'thumbmarkjs',
      deviceFingerprintHash: 'sha256:raw-thumbmark',
      reasonCodes: ['device_fingerprint_collected'],
      metadata: {
        hashAlgorithm: 'sha256',
        rawThumbmarkLength: 13,
        componentCount: 2,
        resultKeys: ['components', 'thumbmark'],
      },
    });
    expect(loadThumbmark).toHaveBeenCalledOnce();
    expect(hashThumbmark).toHaveBeenCalledWith('raw-thumbmark');
    expect(thumbmarkOptions).toEqual([
      {
        logging: false,
        timeout: 700,
      },
    ]);
  });

  it.each(['none', 'essential'] as const)('skips collection for %s consent without loading ThumbmarkJS', async (consent) => {
    const loadThumbmark = vi.fn();
    const service = new DeviceFingerprintCollectingService({
      loadThumbmark,
      isBrowser: () => true,
    });

    await expect(service.collect({ consent })).resolves.toEqual({
      status: 'skipped',
      provider: 'thumbmarkjs',
      deviceFingerprintHash: undefined,
      reasonCodes: ['device_fingerprint_consent_missing'],
      metadata: undefined,
    });
    expect(loadThumbmark).not.toHaveBeenCalled();
  });

  it('returns unavailable outside a browser runtime without importing ThumbmarkJS', async () => {
    const loadThumbmark = vi.fn();
    const service = new DeviceFingerprintCollectingService({
      loadThumbmark,
      isBrowser: () => false,
    });

    await expect(service.collect({ consent: 'behavioral' })).resolves.toEqual({
      status: 'unavailable',
      provider: 'thumbmarkjs',
      deviceFingerprintHash: undefined,
      reasonCodes: ['device_fingerprint_browser_unavailable'],
      metadata: undefined,
    });
    expect(loadThumbmark).not.toHaveBeenCalled();
  });

  it('accepts string, hash, and visitorId ThumbmarkJS result shapes', async () => {
    await expect(collectWithResult('string-thumbmark')).resolves.toMatchObject({
      status: 'collected',
      deviceFingerprintHash: 'sha256:string-thumbmark',
    });
    await expect(collectWithResult({ hash: 'hash-thumbmark' })).resolves.toMatchObject({
      status: 'collected',
      deviceFingerprintHash: 'sha256:hash-thumbmark',
    });
    await expect(collectWithResult({ visitorId: 'visitor-thumbmark' })).resolves.toMatchObject({
      status: 'collected',
      deviceFingerprintHash: 'sha256:visitor-thumbmark',
    });
  });

  it('returns empty when ThumbmarkJS produces no usable fingerprint field', async () => {
    await expect(collectWithResult({ thumbmark: ' ', components: [] })).resolves.toEqual({
      status: 'empty',
      provider: 'thumbmarkjs',
      deviceFingerprintHash: undefined,
      reasonCodes: ['device_fingerprint_empty'],
      metadata: {
        resultKeys: ['components', 'thumbmark'],
      },
    });
  });

  it('returns error metadata when ThumbmarkJS or hashing fails', async () => {
    const service = new DeviceFingerprintCollectingService({
      loadThumbmark: async () => {
        throw new TypeError('thumbmark import failed');
      },
      isBrowser: () => true,
    });

    await expect(service.collect({ consent: 'behavioral' })).resolves.toEqual({
      status: 'error',
      provider: 'thumbmarkjs',
      deviceFingerprintHash: undefined,
      reasonCodes: ['device_fingerprint_collection_error'],
      metadata: {
        errorName: 'TypeError',
        errorMessage: 'thumbmark import failed',
      },
    });

    await expect(
      collectWithResult({ thumbmark: 'raw-thumbmark' }, async () => ' '),
    ).resolves.toMatchObject({
      status: 'error',
      reasonCodes: ['device_fingerprint_collection_error'],
      metadata: {
        errorMessage: 'Device fingerprint hash is empty',
      },
    });
  });
});

function collectWithResult(
  result: string | Record<string, unknown>,
  hashThumbmark = async (thumbmark: string) => `sha256:${thumbmark}`,
) {
  const service = new DeviceFingerprintCollectingService({
    loadThumbmark: async () => ({
      Thumbmark: class {
        async get() {
          return result;
        }
      },
    }),
    hashThumbmark,
    isBrowser: () => true,
  });

  return service.collect({ consent: 'behavioral' });
}
