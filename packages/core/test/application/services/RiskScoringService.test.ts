import { describe, expect, it } from 'vitest';
import { RiskScoringService } from '../../../src/application/services/RiskScoringService';
import type { RiskFactorEntity } from '../../../src/domain/entities/RiskFactorEntity';

describe('RiskScoringService', () => {
  it('returns allow for low-risk factors below 30', () => {
    const service = new RiskScoringService();

    const result = service.score({
      scope: 'transaction',
      factors: [
        factor('warning_dwell', 8, 20, ['warning_dwell_ok']),
        factor('client_environment', 10, 15, ['outdated_browser']),
      ],
    });

    expect(result.score).toBe(18);
    expect(result.decision.level).toBe('allow');
    expect(result.decision.reasons).toHaveLength(2);
  });

  it('returns monitor for scores from 30 to 59', () => {
    const service = new RiskScoringService();

    const result = service.score({
      scope: 'transaction',
      factors: [factor('concurrent_media', 35, 35, ['concurrent_media_active'])],
    });

    expect(result.score).toBe(35);
    expect(result.decision.level).toBe('monitor');
  });

  it('returns step_up for scores from 60 to 84', () => {
    const service = new RiskScoringService();

    const result = service.score({
      scope: 'transaction',
      factors: [
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
        factor('new_recipient', 25, 25, ['new_recipient_in_cooldown']),
      ],
    });

    expect(result.score).toBe(65);
    expect(result.decision.level).toBe('step_up');
  });

  it('returns block for scores at 85 or above and caps score at 100', () => {
    const service = new RiskScoringService();

    const result = service.score({
      scope: 'transaction',
      factors: [
        factor('phishing_text_dom', 50, 50, ['phishing_text_dom']),
        factor('copy_paste_recipient', 40, 40, ['copy_paste_recipient']),
        factor('concurrent_media', 35, 35, ['concurrent_media_active']),
      ],
    });

    expect(result.score).toBe(100);
    expect(result.decision.level).toBe('block');
  });

  it('clamps factor contribution to maxContribution and ignores failed statuses', () => {
    const service = new RiskScoringService();

    const result = service.score({
      scope: 'transaction',
      factors: [
        factor('amount_anomaly', 80, 30, ['amount_above_p95']),
        { ...factor('geoip_jump', 30, 30, ['geoip_impossible_travel']), status: 'timeout' },
        { ...factor('unknown_server_factor', 99, 99, ['unknown']), status: 'unknown_factor' },
      ],
    });

    expect(result.score).toBe(30);
    expect(result.decision.level).toBe('monitor');
    expect(result.factorContributions).toEqual([
      expect.objectContaining({ kind: 'amount_anomaly', contribution: 30, maxContribution: 30 }),
      expect.objectContaining({ kind: 'geoip_jump', contribution: 0, status: 'timeout' }),
      expect.objectContaining({ kind: 'unknown_server_factor', contribution: 0, status: 'unknown_factor' }),
    ]);
    expect(result.decision.reasons).toEqual([
      expect.objectContaining({ code: 'amount_above_p95', factorKind: 'amount_anomaly', contribution: 30 }),
    ]);
  });

  it('orders decision reasons by effective contribution descending', () => {
    const service = new RiskScoringService();

    const result = service.score({
      scope: 'transaction',
      factors: [
        factor('warning_dwell', 20, 20, ['warning_skipped']),
        factor('phishing_text_dom', 50, 50, ['social_engineering_text']),
        factor('new_recipient', 25, 25, ['new_recipient_in_cooldown']),
      ],
    });

    expect(result.decision.reasons.map((reason) => reason.code)).toEqual([
      'social_engineering_text',
      'new_recipient_in_cooldown',
      'warning_skipped',
    ]);
  });
});

function factor(
  kind: string,
  contribution: number,
  maxContribution: number,
  reasonCodes: string[],
): RiskFactorEntity {
  return {
    kind,
    status: 'ok',
    contribution,
    maxContribution,
    reasonCodes,
    source: 'live',
  };
}
