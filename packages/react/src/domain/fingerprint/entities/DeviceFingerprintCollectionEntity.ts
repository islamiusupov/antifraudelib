export type DeviceFingerprintCollectionEntity = {
  status: 'collected' | 'skipped' | 'unavailable' | 'empty' | 'error';
  provider: 'thumbmarkjs';
  deviceFingerprintHash?: string;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
};
