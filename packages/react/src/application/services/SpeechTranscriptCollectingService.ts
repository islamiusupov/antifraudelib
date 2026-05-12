import type {
  SpeechRecognitionResultListEntity,
  SpeechTranscriptCollectingConfigEntity,
} from '../../domain/live/entities/SpeechTranscriptCollectingConfigEntity';
import type { LiveInteractionTargetEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';
import { PhishingTextPatternMatchingService } from './PhishingTextPatternMatchingService';

type UninstallingSpeechTranscriptCollection = () => void;

export class SpeechTranscriptCollectingService {
  constructor(private readonly phishingTextPatternMatchingService = new PhishingTextPatternMatchingService()) {}

  install(config: SpeechTranscriptCollectingConfigEntity): UninstallingSpeechTranscriptCollection {
    const target = config.target ?? (globalThis as unknown as LiveInteractionTargetEntity);
    const recognitionConstructor = target.SpeechRecognition ?? target.webkitSpeechRecognition;
    if (recognitionConstructor === undefined) return () => undefined;

    const recognition = new recognitionConstructor();
    recognition.lang = config.language ?? 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => this.handleTranscript(config, this.extractTranscript(event.results));
    recognition.onerror = () => undefined;

    try {
      recognition.start();
    } catch {
      return () => undefined;
    }

    return () => recognition.stop();
  }

  private handleTranscript(config: SpeechTranscriptCollectingConfigEntity, transcript: string): void {
    if (transcript.trim() === '') return;

    if (this.phishingTextPatternMatchingService.hasWarningText(transcript)) {
      config.onEvent({
        kind: 'warning_shown',
        atMs: this.now(config),
        metadata: {
          source: 'speech',
          transcriptLength: transcript.length,
        },
      });
    }

    if (this.phishingTextPatternMatchingService.hasPhishingText(transcript)) {
      config.onEvent({
        kind: 'phishing_text_observed',
        atMs: this.now(config),
        metadata: {
          source: 'speech',
          transcriptLength: transcript.length,
        },
      });
    }
  }

  private extractTranscript(results: SpeechRecognitionResultListEntity): string {
    const transcripts: string[] = [];
    for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
      const result = results[resultIndex];
      for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
        transcripts.push(result[alternativeIndex].transcript);
      }
    }
    return transcripts.join(' ');
  }

  private now(config: SpeechTranscriptCollectingConfigEntity): number {
    return config.now?.() ?? Date.now();
  }
}
