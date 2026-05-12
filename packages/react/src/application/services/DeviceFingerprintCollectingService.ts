import type { DeviceFingerprintCollectionConfigEntity } from '../../domain/entities/DeviceFingerprintCollectionConfigEntity';
import type { DeviceFingerprintCollectionEntity } from '../../domain/entities/DeviceFingerprintCollectionEntity';

type ThumbmarkResult = string | Record<string, unknown>;

type ThumbmarkClientPort = {
  get(): Promise<ThumbmarkResult>;
};

type ThumbmarkModulePort = {
  Thumbmark: new (options?: Record<string, unknown>) => ThumbmarkClientPort;
};

export type DeviceFingerprintCollectingServiceDependencies = {
  loadThumbmark?: () => Promise<ThumbmarkModulePort>;
  hashThumbmark?: (thumbmark: string) => Promise<string>;
  isBrowser?: () => boolean;
};

const DEFAULT_THUMBMARK_OPTIONS: Record<string, unknown> = {
  logging: false,
};

export class DeviceFingerprintCollectingService {
  constructor(private readonly dependencies: DeviceFingerprintCollectingServiceDependencies = {}) {}

  async collect(config: DeviceFingerprintCollectionConfigEntity): Promise<DeviceFingerprintCollectionEntity> {
    if (config.consent !== 'behavioral') {
      return this.result('skipped', ['device_fingerprint_consent_missing']);
    }

    if (!this.isBrowser()) {
      return this.result('unavailable', ['device_fingerprint_browser_unavailable']);
    }

    try {
      const thumbmarkModule = await this.loadThumbmark();
      const thumbmarkClient = new thumbmarkModule.Thumbmark(this.mergeThumbmarkOptions(config.thumbmarkOptions));
      const thumbmarkResult = await thumbmarkClient.get();
      const rawThumbmark = this.extractRawThumbmark(thumbmarkResult);

      if (rawThumbmark === undefined) {
        return this.result('empty', ['device_fingerprint_empty'], {
          resultKeys: this.resultKeys(thumbmarkResult),
        });
      }

      const deviceFingerprintHash = await this.hashThumbmark(rawThumbmark);
      return this.result(
        'collected',
        ['device_fingerprint_collected'],
        this.collectionMetadata(rawThumbmark, thumbmarkResult),
        deviceFingerprintHash,
      );
    } catch (error) {
      return this.result('error', ['device_fingerprint_collection_error'], this.errorMetadata(error));
    }
  }

  private async loadThumbmark(): Promise<ThumbmarkModulePort> {
    if (this.dependencies.loadThumbmark !== undefined) return this.dependencies.loadThumbmark();
    return import('@thumbmarkjs/thumbmarkjs') as unknown as Promise<ThumbmarkModulePort>;
  }

  private async hashThumbmark(thumbmark: string): Promise<string> {
    const hash = this.dependencies.hashThumbmark !== undefined
      ? await this.dependencies.hashThumbmark(thumbmark)
      : await this.sha256(thumbmark);

    if (hash.trim().length === 0) throw new Error('Device fingerprint hash is empty');
    return hash.trim();
  }

  private async sha256(value: string): Promise<string> {
    if (typeof TextEncoder === 'undefined' || globalThis.crypto?.subtle === undefined) {
      throw new Error('SHA-256 hashing is unavailable');
    }

    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
      .map((byte) => this.toHexByte(byte))
      .join('');
  }

  private toHexByte(byte: number): string {
    const hex = byte.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  }

  private isBrowser(): boolean {
    if (this.dependencies.isBrowser !== undefined) return this.dependencies.isBrowser();
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private mergeThumbmarkOptions(options?: Record<string, unknown>): Record<string, unknown> {
    return {
      ...DEFAULT_THUMBMARK_OPTIONS,
      ...(options ?? {}),
    };
  }

  private extractRawThumbmark(result: ThumbmarkResult): string | undefined {
    if (typeof result === 'string') return this.normalizeNonEmptyString(result);

    return (
      this.normalizeNonEmptyString(result.thumbmark) ??
      this.normalizeNonEmptyString(result.hash) ??
      this.normalizeNonEmptyString(result.visitorId)
    );
  }

  private normalizeNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private collectionMetadata(rawThumbmark: string, result: ThumbmarkResult): Record<string, unknown> {
    return {
      hashAlgorithm: 'sha256',
      rawThumbmarkLength: rawThumbmark.length,
      componentCount: this.componentCount(result),
      resultKeys: this.resultKeys(result),
    };
  }

  private componentCount(result: ThumbmarkResult): number | undefined {
    if (typeof result === 'string') return undefined;
    const components = result.components;
    if (components === null || typeof components !== 'object' || Array.isArray(components)) return undefined;
    return Object.keys(components).length;
  }

  private resultKeys(result: ThumbmarkResult): string[] {
    if (typeof result === 'string') return [];
    return Object.keys(result).sort();
  }

  private errorMetadata(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        errorName: error.name,
        errorMessage: error.message,
      };
    }
    return {
      errorMessage: String(error),
    };
  }

  private result(
    status: DeviceFingerprintCollectionEntity['status'],
    reasonCodes: string[],
    metadata?: Record<string, unknown>,
    deviceFingerprintHash?: string,
  ): DeviceFingerprintCollectionEntity {
    return {
      status,
      provider: 'thumbmarkjs',
      deviceFingerprintHash,
      reasonCodes,
      metadata,
    };
  }
}
