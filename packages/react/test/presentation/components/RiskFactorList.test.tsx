import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';
import { RiskFactorList } from '../../../src/presentation/components/RiskFactorList';

describe('RiskFactorList', () => {
  it('renders scoring and non-scoring factors from context', () => {
    const markup = renderToStaticMarkup(
      <DeepFraudRoot
        userId="user-1"
        consent="behavioral"
        initialFactors={[
          {
            kind: 'device_fingerprint',
            contribution: 0,
            maxContribution: 30,
            status: 'inactive',
            reasonCodes: [],
          },
          {
            kind: 'bot_detection',
            contribution: 50,
            maxContribution: 50,
            status: 'ok',
            reasonCodes: ['bot_detection_webdriver'],
          },
        ]}
      >
        <RiskFactorList className="custom-factors" />
      </DeepFraudRoot>,
    );

    expect(markup).toContain('custom-factors');
    expect(markup).toContain('data-factor-kind="device_fingerprint"');
    expect(markup).toContain('data-factor-status="inactive"');
    expect(markup).toContain('0/30');
    expect(markup).toContain('data-factor-kind="bot_detection"');
    expect(markup).toContain('data-factor-status="ok"');
    expect(markup).toContain('50/50');
  });

  it('renders an empty state when there are no factors', () => {
    expect(
      renderToStaticMarkup(
        <DeepFraudRoot userId="user-1" consent="behavioral">
          <RiskFactorList />
        </DeepFraudRoot>,
      ),
    ).toBe('<p class="deepfraud-risk-factor-list">No risk factors</p>');
  });
});
