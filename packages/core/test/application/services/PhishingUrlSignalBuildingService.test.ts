import { describe, expect, it } from 'vitest';
import { FactorContributionBuildingService } from '../../../src/application/services/FactorContributionBuildingService';
import { PhishingUrlSignalBuildingService } from '../../../src/application/services/PhishingUrlSignalBuildingService';
import { RiskScoringService } from '../../../src/application/services/RiskScoringService';

describe('PhishingUrlSignalBuildingService', () => {
  it('adds a step-up boost for phishing URL reasons', () => {
    const service = new PhishingUrlSignalBuildingService();

    expect(service.build(['phishing_url_typosquat_bank_brand'], { url: 'https://sberbank-online-secure.shop' }))
      .toEqual([
        expect.objectContaining({
          kind: 'phishing_url',
          confidence: 1,
          reasonCodes: ['phishing_url_typosquat_bank_brand'],
        }),
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 20,
          maxContribution: 20,
          reasonCodes: ['phishing_url_step_up_floor'],
          metadata: {
            url: 'https://sberbank-online-secure.shop',
            matchedReasonCodes: ['phishing_url_typosquat_bank_brand'],
          },
        }),
      ]);
  });

  it('adds a blocking boost for high-confidence URLBERT phishing verdicts', () => {
    const service = new PhishingUrlSignalBuildingService();

    const assessment = score(service.build(['urlbert_phishing_high_confidence'], {
      modelScore: 0.93,
      verdict: 'phishing',
    }));

    expect(assessment.score).toBe(85);
    expect(assessment.decision.level).toBe('block');
    expect(assessment.decision.reasons.map((reason) => reason.code)).toEqual([
      'phishing_url_block_floor',
      'urlbert_phishing_high_confidence',
    ]);
  });

  it('keeps monitor URL reasons below step-up', () => {
    const service = new PhishingUrlSignalBuildingService();

    const assessment = score(service.build(['phishing_url_shortener_needs_expansion'], {
      url: 'https://bit.ly/unknown',
    }));

    expect(assessment.score).toBe(30);
    expect(assessment.decision.level).toBe('monitor');
  });

  it.each([
    'phishing_url_legitimate_bank',
    'phishing_url_technical_context_allow',
    'phishing_url_bank_partner_whitelist',
    'urlbert_benign_high_confidence',
    'phishing_url_custom_protocol_deeplink',
  ])('returns no risk signals for allow reason %s', (reasonCode) => {
    const service = new PhishingUrlSignalBuildingService();

    expect(service.build([reasonCode])).toEqual([]);
  });

  it('derives URL reasons from metadata and ignores a generic fallback when the URL is allowlisted', () => {
    const service = new PhishingUrlSignalBuildingService();

    expect(service.build(['phishing_url_pattern'], { url: 'https://sberbank.ru/online' })).toEqual([]);
    expect(service.build(['phishing_url_pattern'], { url: 'https://sberbank-online-secure.shop' }))
      .toEqual([
        expect.objectContaining({
          kind: 'phishing_url',
          reasonCodes: ['phishing_url_typosquat_bank_brand'],
        }),
        expect.objectContaining({
          kind: 'composite_risk_boost',
          reasonCodes: ['phishing_url_step_up_floor'],
        }),
      ]);
  });
});

function score(signals: ReturnType<PhishingUrlSignalBuildingService['build']>) {
  const factorContributionBuildingService = new FactorContributionBuildingService();
  const riskScoringService = new RiskScoringService();

  return riskScoringService.score({
    scope: 'transaction',
    factors: factorContributionBuildingService.buildMany(signals),
  });
}
