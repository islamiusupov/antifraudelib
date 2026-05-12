import { describe, expect, it } from 'vitest';
import { DBankLiveFactorExtractingService } from '../../../src/application/services/DBankLiveFactorExtractingService';
import type { DBankObservedEventEntity } from '../../../src/domain/entities/DBankObservedEventEntity';

describe('DBankLiveFactorExtractingService', () => {
  it('extracts copy-paste recipient and concurrent media live signals', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_pasted', 100),
        event('media_active', 150),
      ]),
    ).toEqual([
      {
        kind: 'copy_paste_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['copy_paste_recipient'],
        source: 'live',
      },
      {
        kind: 'concurrent_media',
        detected: true,
        confidence: 1,
        reasonCodes: ['concurrent_media_active'],
        source: 'live',
      },
    ]);
  });

  it('extracts warning dwell when confirmation is too fast', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('warning_shown', 1000),
        event('warning_confirmed', 1400),
      ]),
    ).toEqual([
      {
        kind: 'warning_dwell',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['warning_dwell_too_short'],
        source: 'live',
      },
    ]);
  });

  it('extracts page visibility oscillation from hidden-visible trace', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('page_hidden', 100),
        event('page_visible', 500),
      ]),
    ).toEqual([
      {
        kind: 'page_visibility',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['page_visibility_oscillation'],
        source: 'live',
      },
    ]);
  });
});

function event(kind: DBankObservedEventEntity['kind'], atMs: number): DBankObservedEventEntity {
  return { kind, atMs };
}
