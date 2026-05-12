import { describe, expect, it } from 'vitest';
import { buildActivityExport, buildActivityPdf } from '../../../src/presentation/components/ActivityExportPanel';

describe('ActivityExportPanel helpers', () => {
  it('builds a windowed activity export with assessment, factors, and sorted events', () => {
    const activity = buildActivityExport({
      assessment,
      factors,
      clockMs: 2000,
      windowMs: 1500,
      observedEvents: [
        {
          event: { kind: 'recipient_pasted', atMs: 900, metadata: { field: 'recipient' } },
          receivedAtMs: 900,
        },
      ],
      iframeLiveEvents: [
        {
          event: { kind: 'page_hidden', atMs: 100, metadata: { source: 'old' } },
          receivedAtMs: 100,
        },
      ],
      iframeBrowserApiEvents: [
        {
          event: { kind: 'fetch_requested', atMs: 1500, allowed: false, metadata: { url: 'https://evil.test' } },
          receivedAtMs: 1500,
        },
      ],
    });

    expect(activity.windowMs).toBe(1500);
    expect(activity.assessment.score).toBe(65);
    expect(activity.factors).toHaveLength(1);
    expect(activity.totalRecordedEventCount).toBe(3);
    expect(activity.events).toEqual([
      {
        source: 'd-bank',
        kind: 'recipient_pasted',
        eventAtMs: 900,
        receivedAtMs: 900,
        receivedAt: new Date(900).toISOString(),
        metadata: { field: 'recipient' },
      },
      {
        source: 'iframe-browser-api',
        kind: 'fetch_requested',
        eventAtMs: 1500,
        receivedAtMs: 1500,
        receivedAt: new Date(1500).toISOString(),
        metadata: { url: 'https://evil.test' },
        allowed: false,
      },
    ]);
  });

  it('builds a PDF activity report', () => {
    const pdf = buildActivityPdf({
      exportedAt: '2026-05-12T16:00:00.000Z',
      windowMs: 30000,
      windowStart: '2026-05-12T15:59:30.000Z',
      windowEnd: '2026-05-12T16:00:00.000Z',
      assessment,
      factors,
      events: [
        {
          source: 'd-bank',
          kind: 'recipient_pasted',
          eventAtMs: 900,
          receivedAtMs: 900,
          receivedAt: new Date(900).toISOString(),
          metadata: { field: 'recipient' },
        },
      ],
      totalRecordedEventCount: 1,
    });

    expect(pdf).toContain('%PDF-1.4');
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toContain('DeepCode Antifraud Activity Report');
    expect(pdf).toContain('recipient_pasted');
    expect(pdf).toContain('startxref');
  });
});

const assessment = {
  scope: 'transaction',
  score: 65,
  decision: {
    level: 'step_up',
    score: 65,
    reasons: [
      {
        factorKind: 'copy_paste_recipient',
        code: 'copy_paste_recipient',
        contribution: 40,
      },
    ],
  },
  factorContributions: [],
} as const;

const factors = [
  {
    kind: 'copy_paste_recipient',
    contribution: 40,
    maxContribution: 40,
    status: 'ok',
    reasonCodes: ['copy_paste_recipient'],
  },
] as const;
