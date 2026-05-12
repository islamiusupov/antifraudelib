import type { BotDetectionCollectionConfigEntity } from '../../domain/entities/BotDetectionCollectionConfigEntity';
import type { BotDetectionCollectionEntity } from '../../domain/entities/BotDetectionCollectionEntity';

type BotDetectionResultPort = {
  bot: boolean;
  botKind?: string;
};

type BotDetectionAgentPort = {
  detect(): BotDetectionResultPort | Promise<BotDetectionResultPort>;
};

type BotDetectionModulePort = {
  load(options?: Record<string, unknown>): Promise<BotDetectionAgentPort>;
};

export type BotDetectionCollectingServiceDependencies = {
  loadBotD?: () => Promise<BotDetectionModulePort>;
  isBrowser?: () => boolean;
};

const DEFAULT_BOT_DETECTION_OPTIONS: Record<string, unknown> = {
  monitoring: false,
};

export class BotDetectionCollectingService {
  constructor(private readonly dependencies: BotDetectionCollectingServiceDependencies = {}) {}

  async collect(config: BotDetectionCollectionConfigEntity): Promise<BotDetectionCollectionEntity> {
    if (config.consent !== 'behavioral') {
      return this.result('skipped', ['bot_detection_consent_missing']);
    }

    if (!this.isBrowser()) {
      return this.result('unavailable', ['bot_detection_browser_unavailable']);
    }

    try {
      const botDetectionModule = await this.loadBotD();
      const agent = await botDetectionModule.load(this.mergeOptions(config.botDetectionOptions));
      const detection = await agent.detect();

      if (detection.bot) {
        const botKind = this.normalizeBotKind(detection.botKind);
        return this.result('detected', [`bot_detection_${botKind}`], botKind, {
          bot: true,
        });
      }

      return this.result('not_detected', ['bot_detection_not_detected'], undefined, {
        bot: false,
      });
    } catch (error) {
      return this.result('error', ['bot_detection_collection_error'], undefined, this.errorMetadata(error));
    }
  }

  private async loadBotD(): Promise<BotDetectionModulePort> {
    if (this.dependencies.loadBotD !== undefined) return this.dependencies.loadBotD();
    return import('@fingerprintjs/botd') as unknown as Promise<BotDetectionModulePort>;
  }

  private isBrowser(): boolean {
    if (this.dependencies.isBrowser !== undefined) return this.dependencies.isBrowser();
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private mergeOptions(options?: Record<string, unknown>): Record<string, unknown> {
    return {
      ...DEFAULT_BOT_DETECTION_OPTIONS,
      ...(options ?? {}),
    };
  }

  private normalizeBotKind(botKind: unknown): string {
    if (typeof botKind !== 'string') return 'unknown';
    const normalized = botKind.trim();
    return normalized.length > 0 ? normalized : 'unknown';
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
    status: BotDetectionCollectionEntity['status'],
    reasonCodes: string[],
    botKind?: string,
    metadata?: Record<string, unknown>,
  ): BotDetectionCollectionEntity {
    return {
      status,
      provider: 'botd',
      botKind,
      reasonCodes,
      metadata,
    };
  }
}
