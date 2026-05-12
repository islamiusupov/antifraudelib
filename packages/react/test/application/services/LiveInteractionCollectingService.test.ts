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

  it('captures pasted transfer amounts in amount fields', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 250,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('paste', {
      target: { name: 'transferAmount', type: 'number', placeholder: 'Amount' },
      clipboardData: {
        getData: () => '87000',
      },
    });

    expect(events).toEqual([
      {
        kind: 'amount_pasted',
        atMs: 250,
        metadata: {
          targetText: 'transferAmount number Amount',
          pastedLength: 5,
        },
      },
    ]);
  });

  it('captures amount fields filled without typing when paste events are missing', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const amountTarget = { name: 'transferAmount', type: 'number', value: '87000' };

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 255,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('input', {
      target: amountTarget,
    });

    expect(events).toEqual([
      {
        kind: 'amount_pasted',
        atMs: 255,
        metadata: {
          targetText: 'transferAmount number',
          pastedLength: 5,
          reason: 'filled_without_typing',
        },
      },
    ]);
  });

  it('does not duplicate amount paste when input fires after a paste event', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const amountTarget = { name: 'transferAmount', type: 'number', value: '' };

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 257,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('paste', {
      target: amountTarget,
      clipboardData: {
        getData: () => '87000',
      },
    });
    amountTarget.value = '87000';
    documentTarget.dispatch('input', { target: amountTarget });

    expect(events.map((event) => event.kind)).toEqual(['amount_pasted']);
  });

  it('captures amount bulk input jumps after an initial typed digit', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const amountTarget = { name: 'transferAmount', type: 'number', value: '' };
    let now = 600;

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => now,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('keydown', { target: amountTarget, key: '8', isTrusted: true });
    amountTarget.value = '8';
    documentTarget.dispatch('input', { target: amountTarget });
    now = 700;
    amountTarget.value = '87000';
    documentTarget.dispatch('input', { target: amountTarget });

    expect(events).toEqual([
      {
        kind: 'amount_pasted',
        atMs: 700,
        metadata: {
          targetText: 'transferAmount number',
          pastedLength: 5,
          reason: 'bulk_input_jump',
        },
      },
    ]);
  });

  it('captures recipient fields filled without typing when paste events are missing', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const recipientTarget = { name: 'recipientAccount', value: '40817810000000000001' };

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 260,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('input', {
      target: recipientTarget,
    });

    expect(events).toEqual([
      {
        kind: 'recipient_pasted',
        atMs: 260,
        metadata: {
          targetText: 'recipientAccount',
          pastedLength: 20,
          reason: 'filled_without_typing',
        },
      },
    ]);
  });

  it('does not flag recipient values typed one key at a time', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const recipientTarget = { name: 'recipientAccount', value: '' };
    let now = 300;

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => now,
      onEvent: (event) => events.push(event),
    });

    '408178100000'.split('').forEach((digit) => {
      now += 100;
      documentTarget.dispatch('keydown', { target: recipientTarget, key: digit, isTrusted: true });
      recipientTarget.value += digit;
      documentTarget.dispatch('input', { target: recipientTarget });
    });

    expect(events).toEqual([]);
  });

  it('does not duplicate recipient paste when input fires after a paste event', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const recipientTarget = { name: 'recipientAccount', value: '' };

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 500,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('paste', {
      target: recipientTarget,
      clipboardData: {
        getData: () => '40817810000000000001',
      },
    });
    recipientTarget.value = '40817810000000000001';
    documentTarget.dispatch('input', { target: recipientTarget });

    expect(events.map((event) => event.kind)).toEqual(['recipient_pasted']);
  });

  it('captures long recipient details filled into several fields in sequence', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const ibanTarget = { name: 'recipientIban', value: 'DE89370400440532013000' };
    const bicTarget = { name: 'recipientBic', value: 'DEUTDEFF500' };
    const nameTarget = { name: 'recipientName', value: 'Security Service LLC' };
    let now = 1000;

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => now,
      onEvent: (event) => events.push(event),
    });

    [ibanTarget, bicTarget, nameTarget].forEach((target) => {
      documentTarget.dispatch('input', { target });
      now += 300;
    });

    expect(events.map((event) => event.kind)).toEqual([
      'recipient_pasted',
      'recipient_pasted',
      'recipient_pasted',
      'form_fill_order_observed',
    ]);
    expect(events[3]).toMatchObject({
      kind: 'form_fill_order_observed',
      metadata: {
        reason: 'multi_field_recipient_bulk_fill',
        fieldCount: 3,
        windowMs: 5000,
      },
    });
  });

  it('does not flag multi-field recipient order for two filled fields only', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 1300,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('input', {
      target: { name: 'recipientIban', value: 'DE89370400440532013000' },
    });
    documentTarget.dispatch('input', {
      target: { name: 'recipientBic', value: 'DEUTDEFF500' },
    });

    expect(events.map((event) => event.kind)).toEqual(['recipient_pasted', 'recipient_pasted']);
  });

  it('does not flag several recipient fields typed manually digit by digit', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    const fields = [
      { name: 'recipientIban', value: '', nextValue: '408178100000' },
      { name: 'recipientBic', value: '', nextValue: '044525225' },
      { name: 'recipientAccount', value: '', nextValue: '407028100000' },
    ];
    let now = 2000;

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => now,
      onEvent: (event) => events.push(event),
    });

    fields.forEach((field) => {
      field.nextValue.split('').forEach((digit) => {
        now += 100;
        documentTarget.dispatch('keydown', { target: field, key: digit, isTrusted: true });
        field.value += digit;
        documentTarget.dispatch('input', { target: field });
      });
    });

    expect(events).toEqual([]);
  });

  it('captures suspicious bank chat input text', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 300,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('input', {
      target: {
        value: 'В чате банка пишу: это мошенник просит код из СМС',
      },
    });

    expect(events.map((event) => event.kind)).toEqual(['warning_shown', 'phishing_text_observed']);
    expect(events[1]).toMatchObject({
      kind: 'phishing_text_observed',
      atMs: 300,
      metadata: {
        source: 'input',
      },
    });
  });

  it('captures fast key bursts and rapid nervous scrolling', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    let now = 100;

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      rapidScrollMinimumEvents: 3,
      now: () => now,
      onEvent: (event) => events.push(event),
    });

    [100, 140, 180, 220].forEach((time) => {
      now = time;
      documentTarget.dispatch('keydown', { key: '1', isTrusted: true });
    });
    [300, 420, 540].forEach((time) => {
      now = time;
      documentTarget.dispatch('wheel', { deltaY: 160 });
    });

    expect(events.map((event) => event.kind)).toEqual([
      'keystroke_anomaly_observed',
      'rapid_scroll_observed',
    ]);
  });

  it('captures click bursts across the site', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];
    let now = 100;

    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      clickBurstMinimumEvents: 4,
      clickBurstWindowMs: 1000,
      now: () => now,
      onEvent: (event) => events.push(event),
    });

    [100, 250, 400, 550].forEach((time) => {
      now = time;
      documentTarget.dispatch('click', { target: { textContent: 'Menu' } });
    });

    expect(events).toEqual([
      {
        kind: 'click_burst_observed',
        atMs: 550,
        metadata: {
          eventCount: 4,
          windowMs: 1000,
        },
      },
    ]);
  });

  it('captures scroll events while warning text is visible', () => {
    const documentTarget = new FakeDocumentTarget();
    const events: LiveInteractionEventEntity[] = [];

    documentTarget.body.innerText = 'Fraud warning: suspicious transfer';
    new LiveInteractionCollectingService().install({
      target: { document: documentTarget },
      now: () => 900,
      onEvent: (event) => events.push(event),
    });

    documentTarget.dispatch('wheel', { deltaY: 20 });

    expect(events).toEqual([
      {
        kind: 'warning_scrolled',
        atMs: 900,
        metadata: { source: 'wheel' },
      },
    ]);
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
