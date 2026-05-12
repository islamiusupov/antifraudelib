import type { LiveInteractionEventEntity } from './LiveInteractionEventEntity';
import type { LiveInteractionTargetEntity } from './LiveInteractionTargetEntity';

export type SpeechTranscriptCollectingConfigEntity = {
  onEvent(event: LiveInteractionEventEntity): void;
  target?: LiveInteractionTargetEntity;
  language?: string;
  now?: () => number;
};

export type SpeechRecognitionResultListEntity = {
  length: number;
  [index: number]: SpeechRecognitionResultEntity;
};

export type SpeechRecognitionResultEntity = {
  length: number;
  [index: number]: SpeechRecognitionAlternativeEntity;
};

export type SpeechRecognitionAlternativeEntity = {
  transcript: string;
};
