import { describe, expect, it } from 'vitest';
import { BotDetectionRiskFactorBuildingService } from '../../../src/application/services/BotDetectionRiskFactorBuildingService';

describe('BotDetectionRiskFactorBuildingService', () => {
  it('maps detected bots into a scoring bot_detection factor', () => {
    const service = new BotDetectionRiskFactorBuildingService();

    expect(
      service.build({
        status: 'detected',
        provider: 'botd',
        botKind: 'selenium',
        reasonCodes: ['bot_detection_selenium'],
        metadata: {
          bot: true,
        },
      }),
    ).toEqual([
      {
        kind: 'bot_detection',
        status: 'ok',
        contribution: 50,
        maxContribution: 50,
        reasonCodes: ['bot_detection_selenium'],
        source: 'live',
        metadata: {
          provider: 'botd',
          status: 'detected',
          botKind: 'selenium',
          bot: true,
        },
      },
    ]);
  });

  it('maps not detected sessions into a non-scoring inactive factor', () => {
    const service = new BotDetectionRiskFactorBuildingService();

    expect(
      service.build({
        status: 'not_detected',
        provider: 'botd',
        reasonCodes: ['bot_detection_not_detected'],
      }),
    ).toEqual([
      {
        kind: 'bot_detection',
        status: 'inactive',
        contribution: 0,
        maxContribution: 50,
        reasonCodes: [],
        source: 'live',
        metadata: {
          provider: 'botd',
          status: 'not_detected',
          botKind: undefined,
        },
      },
    ]);
  });

  it.each([
    ['unavailable', 'insufficient_data'],
    ['error', 'error'],
  ] as const)('maps %s collection into a non-scoring %s factor', (collectionStatus, factorStatus) => {
    const service = new BotDetectionRiskFactorBuildingService();

    expect(
      service.build({
        status: collectionStatus,
        provider: 'botd',
        reasonCodes: [`bot_detection_${collectionStatus}`],
      })[0],
    ).toMatchObject({
      kind: 'bot_detection',
      status: factorStatus,
      contribution: 0,
      maxContribution: 50,
      reasonCodes: [`bot_detection_${collectionStatus}`],
      source: 'live',
    });
  });

  it('does not produce a factor when collection is skipped by consent', () => {
    const service = new BotDetectionRiskFactorBuildingService();

    expect(
      service.build({
        status: 'skipped',
        provider: 'botd',
        reasonCodes: ['bot_detection_consent_missing'],
      }),
    ).toEqual([]);
  });
});
