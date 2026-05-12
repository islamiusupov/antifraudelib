import type { BrowserApiInterceptionEventEntity } from './BrowserApiInterceptionEventEntity';
import type { BrowserApiInterceptionTargetEntity } from './BrowserApiInterceptionTargetEntity';

export type BrowserApiInterceptionConfigEntity = {
  allowedUrls?: Array<string | RegExp>;
  onEvent(event: BrowserApiInterceptionEventEntity): void;
  target?: BrowserApiInterceptionTargetEntity;
  now?: () => number;
};
