import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';
import { RiskMeter } from '../../../src/presentation/components/RiskMeter';

describe('RiskMeter', () => {
  it('renders the current score and decision level from context', () => {
    const markup = renderToStaticMarkup(
      <DeepFraudRoot
        userId="user-1"
        consent="behavioral"
        initialFactors={[
          {
            kind: 'copy_paste_recipient',
            contribution: 40,
            maxContribution: 40,
            status: 'ok',
            reasonCodes: ['copy_paste_recipient'],
          },
          {
            kind: 'new_recipient',
            contribution: 25,
            maxContribution: 25,
            status: 'ok',
            reasonCodes: ['new_recipient_in_cooldown'],
          },
        ]}
      >
        <RiskMeter />
      </DeepFraudRoot>,
    );

    expect(markup).toContain('data-decision="step_up"');
    expect(markup).toContain('65');
    expect(markup).toContain('width:65%');
  });

  it('can hide the numeric score while preserving the accessible score label', () => {
    const markup = renderToStaticMarkup(
      <DeepFraudRoot
        userId="user-1"
        consent="behavioral"
        initialFactors={[
          {
            kind: 'dev_environment',
            contribution: 15,
            maxContribution: 15,
            status: 'ok',
            reasonCodes: ['dev_environment'],
          },
        ]}
      >
        <RiskMeter className="custom-meter" showScore={false} />
      </DeepFraudRoot>,
    );

    expect(markup).toContain('custom-meter');
    expect(markup).toContain('aria-label="Risk score 15"');
    expect(markup).toContain('width:15%');
    expect(markup).not.toContain('deepfraud-risk-meter__score');
  });
});
