import { describe, expect, it } from 'vitest';
import { LiveInteractionCollectingService } from '../../../src/application/services/LiveInteractionCollectingService';
import type { LiveInteractionEventEntity } from '../../../src/domain/live/entities/LiveInteractionEventEntity';
import type {
  LiveInteractionDomEventEntity,
  LiveInteractionTargetEntity,
} from '../../../src/domain/live/entities/LiveInteractionTargetEntity';

describe('LiveInteractionCollectingService', () => {
  it('captures paste, visibility, pointer, keystroke, click, and mutation observer signals', () => {
    const documentTarget = new FakeDocumentTarget();
    const windowTarget = new FakeWindowTarget();
    const mutationObservers: FakeMutationObserver[] = [];
    const target: LiveInteractionTargetEntity = {
      document: documentTarget,
      window: windowTarget,
      MutationObserver: class extends FakeMutationObserver {
        constructor(callback: () => void) {
          super(callback);
          mutationObservers.push(this);
        }
      },
    };
    const events: LiveInteractionEventEntity[] = [];
    let now = 100;
    const uninstall = new LiveInteractionCollectingService().install({
      target,
      pointerJumpThresholdPx: 500,
      fastKeyIntervalMs: 8,
      now: () => now,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('paste', {
      target: { name: 'recipientAccount' },
      clipboardData: {
        getData: () => '40817810000000000001',
      },
    });
    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatch('visibilitychange', {});
    windowTarget.dispatch('focus');
    documentTarget.dispatch('pointermove', { clientX: 0, clientY: 0 });
    now = 120;
    documentTarget.dispatch('pointermove', { clientX: 900, clientY: 0 });
    [121, 122, 123, 124].forEach((time) => {
      now = time;
      documentTarget.dispatch('keydown', { key: '1', isTrusted: true });
    });
    documentTarget.dispatch('keydown', { key: '2', isTrusted: false });
    documentTarget.dispatch('click', { target: { textContent: 'Подтвердить перевод' } });
    documentTarget.body.innerText = 'Предупреждение: сотрудник МВД просит безопасный счет';
    mutationObservers[0].trigger();
    uninstall();

    expect(events.map((event) => event.kind)).toEqual([
      'recipient_pasted',
      'page_hidden',
      'page_visible',
      'pointer_anomaly_observed',
      'keystroke_anomaly_observed',
      'keystroke_anomaly_observed',
      'warning_confirmed',
      'warning_shown',
      'phishing_text_observed',
    ]);
    expect(documentTarget.listenerCount()).toBe(0);
    expect(windowTarget.listenerCount()).toBe(0);
    expect(mutationObservers[0].disconnected).toBe(true);
  });

  it('ignores ordinary paste text and small pointer movement', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    let now = 100;

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => now,
      onEvent: (event) => events.push(event),
    });
    documentTarget.dispatch('paste', {
      target: { name: 'comment' },
      clipboardData: {
        getData: () => 'ordinary note',
      },
    });
    documentTarget.dispatch('pointermove', { clientX: 0, clientY: 0 });
    now = 150;
    documentTarget.dispatch('pointermove', { clientX: 10, clientY: 10 });

    expect(events).toEqual([]);
  });
});

class FakeDocumentTarget {
  body = { innerText: '' };
  visibilityState = 'visible';
  private readonly listeners = new Map<string, Array<(event: LiveInteractionDomEventEntity) => void>>();

  addEventListener(type: string, listener: (event: LiveInteractionDomEventEntity) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: (event: LiveInteractionDomEventEntity) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  dispatch(type: string, event: LiveInteractionDomEventEntity): void {
    (this.listeners.get(type) ?? []).forEach((listener) => listener(event));
  }

  listenerCount(): number {
    return Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0);
  }
}

class FakeWindowTarget {
  private readonly listeners = new Map<string, Array<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  dispatch(type: string): void {
    (this.listeners.get(type) ?? []).forEach((listener) => listener());
  }

  listenerCount(): number {
    return Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0);
  }
}

class FakeMutationObserver {
  disconnected = false;

  constructor(private readonly callback: () => void) {}

  observe(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback();
  }
}
