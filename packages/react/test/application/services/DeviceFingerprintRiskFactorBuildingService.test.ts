import { describe, expect, it } from 'vitest';
import { DeviceFingerprintRiskFactorBuildingService } from '../../../src/application/services/DeviceFingerprintRiskFactorBuildingService';

describe('DeviceFingerprintRiskFactorBuildingService', () => {
  it('maps a collected fingerprint into a non-scoring session factor with hash metadata', () => {
    const service = new DeviceFingerprintRiskFactorBuildingService();

    expect(
      service.build({
        status: 'collected',
        provider: 'thumbmarkjs',
        deviceFingerprintHash: 'sha256:abc',
        reasonCodes: ['device_fingerprint_collected'],
        metadata: {
          componentCount: 2,
        },
      }),
    ).toEqual([
      {
        kind: 'device_fingerprint',
        status: 'inactive',
        contribution: 0,
        maxContribution: 30,
        reasonCodes: [],
        source: 'live',
        metadata: {
          provider: 'thumbmarkjs',
          status: 'collected',
          deviceFingerprintHash: 'sha256:abc',
          componentCount: 2,
        },
      },
    ]);
  });

  it.each([
    ['empty', 'insufficient_data'],
    ['unavailable', 'insufficient_data'],
    ['error', 'error'],
  ] as const)('maps %s collection into a non-scoring %s factor', (collectionStatus, factorStatus) => {
    const service = new DeviceFingerprintRiskFactorBuildingService();

    expect(
      service.build({
        status: collectionStatus,
        provider: 'thumbmarkjs',
        reasonCodes: [`device_fingerprint_${collectionStatus}`],
      })[0],
    ).toMatchObject({
      kind: 'device_fingerprint',
      status: factorStatus,
      contribution: 0,
      maxContribution: 30,
      reasonCodes: [`device_fingerprint_${collectionStatus}`],
      source: 'live',
    });
  });

  it('does not produce a factor when collection is skipped by consent', () => {
    const service = new DeviceFingerprintRiskFactorBuildingService();

    expect(
      service.build({
        status: 'skipped',
        provider: 'thumbmarkjs',
        reasonCodes: ['device_fingerprint_consent_missing'],
      }),
    ).toEqual([]);
  });
});
