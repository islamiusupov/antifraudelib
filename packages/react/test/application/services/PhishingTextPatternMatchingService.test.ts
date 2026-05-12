import { describe, expect, it } from 'vitest';
import { PhishingTextPatternMatchingService } from '../../../src/application/services/PhishingTextPatternMatchingService';

describe('PhishingTextPatternMatchingService', () => {
  it('detects social-engineering text in English and Russian', () => {
    const service = new PhishingTextPatternMatchingService();

    expect(service.hasPhishingText('Move funds to the safe account and do not tell the bank')).toBe(true);
    expect(service.hasPhishingText('Сотрудник МВД просит перевести деньги на безопасный счет')).toBe(true);
    expect(service.hasPhishingText('Никому не говорите код из смс')).toBe(true);
  });

  it('detects warning copy separately from phishing copy', () => {
    const service = new PhishingTextPatternMatchingService();

    expect(service.hasWarningText('Fraud warning: suspicious transfer')).toBe(true);
    expect(service.hasWarningText('Предупреждение о мошенничестве')).toBe(true);
    expect(service.hasWarningText('Transfer details')).toBe(false);
  });

  it('does not flag ordinary bank text', () => {
    const service = new PhishingTextPatternMatchingService();

    expect(service.hasPhishingText('Transfer to saved beneficiary')).toBe(false);
    expect(service.hasWarningText('Saved template')).toBe(false);
  });
});
