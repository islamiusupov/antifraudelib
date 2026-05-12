import type { RiskFactorEntity } from '@deepcode/antifraud-core';
import type { SessionSignalCollectionConfigEntity } from '../../domain/entities/SessionSignalCollectionConfigEntity';
import { BotDetectionCollectingService } from './BotDetectionCollectingService';
import { BotDetectionRiskFactorBuildingService } from './BotDetectionRiskFactorBuildingService';
import { DeviceFingerprintCollectingService } from './DeviceFingerprintCollectingService';
import { DeviceFingerprintRiskFactorBuildingService } from './DeviceFingerprintRiskFactorBuildingService';

export class SessionSignalCollectingService {
  constructor(
    private readonly deviceFingerprintCollectingService = new DeviceFingerprintCollectingService(),
    private readonly deviceFingerprintRiskFactorBuildingService = new DeviceFingerprintRiskFactorBuildingService(),
    private readonly botDetectionCollectingService = new BotDetectionCollectingService(),
    private readonly botDetectionRiskFactorBuildingService = new BotDetectionRiskFactorBuildingService(),
  ) {}

  async collect(config: SessionSignalCollectionConfigEntity): Promise<RiskFactorEntity[]> {
    const factorTasks: Array<Promise<RiskFactorEntity[]>> = [];

    if (config.collectDeviceFingerprint !== false) {
      factorTasks.push(this.collectDeviceFingerprint(config));
    }

    if (config.collectBotDetection !== false) {
      factorTasks.push(this.collectBotDetection(config));
    }

    const factorLists = await Promise.all(factorTasks);
    const factors: RiskFactorEntity[] = [];
    factorLists.forEach((factorList) => factors.push(...factorList));
    return factors;
  }

  private async collectDeviceFingerprint(config: SessionSignalCollectionConfigEntity): Promise<RiskFactorEntity[]> {
    const collection = await this.deviceFingerprintCollectingService.collect({
      consent: config.consent,
      thumbmarkOptions: config.thumbmarkOptions,
    });
    return this.deviceFingerprintRiskFactorBuildingService.build(collection);
  }

  private async collectBotDetection(config: SessionSignalCollectionConfigEntity): Promise<RiskFactorEntity[]> {
    const collection = await this.botDetectionCollectingService.collect({
      consent: config.consent,
      botDetectionOptions: config.botDetectionOptions,
    });
    return this.botDetectionRiskFactorBuildingService.build(collection);
  }
}
