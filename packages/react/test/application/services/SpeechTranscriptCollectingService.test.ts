import { describe, expect, it } from 'vitest';
import { SpeechTranscriptCollectingService } from '../../../src/application/services/SpeechTranscriptCollectingService';
import type { LiveInteractionEventEntity } from '../../../src/domain/live/entities/LiveInteractionEventEntity';
import type {
  LiveInteractionSpeechRecognitionEventEntity,
  LiveInteractionTargetEntity,
} from '../../../src/domain/live/entities/LiveInteractionTargetEntity';

describe('SpeechTranscriptCollectingService', () => {
  it('emits phishing text events from suspicious speech transcripts', () => {
    const events: LiveInteractionEventEntity[] = [];
    let recognition: FakeSpeechRecognition | undefined;
    const target: LiveInteractionTargetEntity = {
      SpeechRecognition: class extends FakeSpeechRecognition {
        constructor() {
          super();
          recognition = this;
        }
      },
    };

    const uninstall = new SpeechTranscriptCollectingService().install({
      target,
      now: () => 500,
      onEvent: (event) => events.push(event),
    });

    recognition?.trigger('Это мошенник просит код из СМС');
    uninstall();

    expect(recognition?.started).toBe(true);
    expect(recognition?.stopped).toBe(true);
    expect(events.map((event) => event.kind)).toEqual(['warning_shown', 'phishing_text_observed']);
    expect(events[1]).toMatchObject({
      kind: 'phishing_text_observed',
      atMs: 500,
      metadata: {
        source: 'speech',
      },
    });
  });

  it('does nothing when speech recognition is unavailable', () => {
    const events: LiveInteractionEventEntity[] = [];

    const uninstall = new SpeechTranscriptCollectingService().install({
      target: {},
      onEvent: (event) => events.push(event),
    });
    uninstall();

    expect(events).toEqual([]);
  });
});

class FakeSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult?: (event: LiveInteractionSpeechRecognitionEventEntity) => void;
  onerror?: () => void;
  started = false;
  stopped = false;

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }

  trigger(transcript: string): void {
    this.onresult?.({
      results: {
        0: {
          0: { transcript },
          length: 1,
        },
        length: 1,
      },
    });
  }
}
