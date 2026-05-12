export type BotDetectionCollectionEntity = {
  status: 'detected' | 'not_detected' | 'skipped' | 'unavailable' | 'error';
  provider: 'botd';
  botKind?: string;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
};
