import { describe, expect, it } from 'vitest';
import { FactorContributionBuildingService } from '../../../src/application/services/FactorContributionBuildingService';

describe('FactorContributionBuildingService', () => {
  it('builds a live factor contribution from PRD max weights', () => {
    const service = new FactorContributionBuildingService();

    expect(
      service.build({
        kind: 'copy_paste_recipient',
        detected: true,
        reasonCodes: ['copy_paste_recipient'],
      }),
    ).toEqual({
      kind: 'copy_paste_recipient',
      status: 'ok',
      contribution: 40,
      maxContribution: 40,
      reasonCodes: ['copy_paste_recipient'],
      source: 'live',
      metadata: undefined,
    });
  });

  it('scales contribution by confidence and caps overrides to the factor max weight', () => {
    const service = new FactorContributionBuildingService();

    expect(
      service.build({
        kind: 'phishing_text_dom',
        detected: true,
        confidence: 0.5,
        reasonCodes: ['social_engineering_text'],
      }).contribution,
    ).toBe(30);

    expect(
      service.build({
        kind: 'amount_anomaly',
        detected: true,
        contribution: 80,
        reasonCodes: ['amount_above_p95'],
      }).contribution,
    ).toBe(30);
  });

  it('marks inactive signals without losing the configured max contribution', () => {
    const service = new FactorContributionBuildingService();

    const contribution = service.build({
      kind: 'clipboard_otp_pattern',
      detected: false,
    });

    expect(contribution.status).toBe('inactive');
    expect(contribution.contribution).toBe(0);
    expect(contribution.maxContribution).toBe(50);
    expect(contribution.reasonCodes).toEqual([]);
    expect(contribution.source).toBe('live');
  });

  it('keeps unknown custom factors usable when a max contribution is provided', () => {
    const service = new FactorContributionBuildingService();

    expect(
      service.build({
        kind: 'bank_custom_watchlist',
        detected: true,
        contribution: 12,
        maxContribution: 20,
        source: 'server',
        reasonCodes: ['bank_custom_watchlist_hit'],
      }),
    ).toEqual({
      kind: 'bank_custom_watchlist',
      status: 'ok',
      contribution: 12,
      maxContribution: 20,
      reasonCodes: ['bank_custom_watchlist_hit'],
      source: 'server',
      metadata: undefined,
    });
  });

  it('clamps confidence outside the 0..1 range', () => {
    const service = new FactorContributionBuildingService();

    expect(
      service.build({
        kind: 'warning_dwell',
        detected: true,
        confidence: 2,
      }).contribution,
    ).toBe(20);

    expect(
      service.build({
        kind: 'warning_dwell',
        detected: true,
        confidence: -1,
      }).contribution,
    ).toBe(0);
  });

  it('uses explicit non-ok status as non-scoring even when detected is true', () => {
    const service = new FactorContributionBuildingService();

    expect(
      service.build({
        kind: 'geoip_jump',
        detected: true,
        status: 'timeout',
        contribution: 30,
        reasonCodes: ['geoip_impossible_travel'],
      }),
    ).toMatchObject({
      kind: 'geoip_jump',
      status: 'timeout',
      contribution: 0,
      maxContribution: 30,
      reasonCodes: ['geoip_impossible_travel'],
    });
  });

  it('normalizes non-finite and negative override values to zero', () => {
    const service = new FactorContributionBuildingService();

    expect(
      service.build({
        kind: 'bank_custom_watchlist',
        detected: true,
        contribution: Number.POSITIVE_INFINITY,
        maxContribution: -10,
      }),
    ).toMatchObject({
      contribution: 0,
      maxContribution: 0,
    });
  });
});
