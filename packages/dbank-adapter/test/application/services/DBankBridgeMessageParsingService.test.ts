import { describe, expect, it } from 'vitest';
import { DBankBridgeMessageParsingService } from '../../../src/application/services/DBankBridgeMessageParsingService';

describe('DBankBridgeMessageParsingService', () => {
  it('parses a valid D-bank bridge event', () => {
    const service = new DBankBridgeMessageParsingService();

    expect(
      service.parse({
        source: 'd-bank',
        type: 'd-bank:event',
        payload: {
          kind: 'recipient_pasted',
          atMs: 120,
          metadata: { field: 'recipient' },
        },
      }),
    ).toEqual({
      source: 'd-bank',
      type: 'd-bank:event',
      payload: {
        kind: 'recipient_pasted',
        atMs: 120,
        metadata: { field: 'recipient' },
      },
    });
  });

  it('ignores unrelated or malformed messages', () => {
    const service = new DBankBridgeMessageParsingService();

    expect(service.parse({ source: 'other', type: 'd-bank:event', payload: {} })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'other', payload: {} })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'd-bank:event', payload: { kind: 'recipient_pasted' } })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'd-bank:event', payload: { kind: 'unknown', atMs: 1 } })).toBeNull();
    expect(service.parse(null)).toBeNull();
  });
});
