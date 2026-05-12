import { describe, expect, it } from 'vitest';
import { FieldInputCollectingService } from '../../../src/application/services/FieldInputCollectingService';

describe('FieldInputCollectingService', () => {
  it('collects recipient paste and multi-field bulk fill events', () => {
    const service = new FieldInputCollectingService();
    const states = service.createInputStates();
    const bulkState = service.createRecipientBulkFillTrackingState();
    const fields = [
      { name: 'recipientIban' },
      { name: 'recipientBic' },
      { name: 'recipientName' },
    ];

    const events = fields.flatMap((field, index) => (
      service.collectPasteEvents(states, bulkState, field, '40817810000000000001', index * 100)
    ));

    expect(events.map((event) => event.kind)).toEqual([
      'recipient_pasted',
      'recipient_pasted',
      'recipient_pasted',
      'form_fill_order_observed',
    ]);
    expect(events[0].metadata).toMatchObject({
      targetText: 'recipientIban',
      pastedLength: 20,
      manualKeyCount: 0,
    });
  });

  it('collects amount input jumps after an initial typed digit', () => {
    const service = new FieldInputCollectingService();
    const states = service.createInputStates();
    const bulkState = service.createRecipientBulkFillTrackingState();
    const amountTarget = { name: 'transferAmount', type: 'number', value: '' };

    service.recordTypedKey(states, amountTarget, '8');
    amountTarget.value = '8';
    expect(service.collectInputEvents(states, bulkState, amountTarget, 100)).toEqual([]);

    amountTarget.value = '87000';
    expect(service.collectInputEvents(states, bulkState, amountTarget, 200)).toEqual([
      {
        kind: 'amount_pasted',
        metadata: {
          targetText: 'transferAmount number',
          pastedLength: 5,
          reason: 'bulk_input_jump',
          manualKeyCount: 1,
          keyCount: 1,
        },
      },
    ]);
  });

  it('identifies authentication targets and correction expected recipient text', () => {
    const service = new FieldInputCollectingService();

    expect(service.isAuthenticationTarget({ type: 'password', name: 'recipientPassword' })).toBe(true);
    expect(service.isAuthenticationTarget({ name: 'recipientAccount' })).toBe(false);
    expect(service.isCorrectionExpectedTarget({ name: 'recipientName', value: 'Alice' })).toBe(true);
  });
});
