import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DecisionBadge } from '../../../src/presentation/components/DecisionBadge';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';

describe('DecisionBadge', () => {
  it('renders a human-readable badge for the current decision', () => {
    const markup = renderToStaticMarkup(
      <DeepFraudRoot
        userId="user-1"
        consent="behavioral"
        initialFactors={[
          {
            kind: 'phishing_text_dom',
            contribution: 60,
            maxContribution: 60,
            status: 'ok',
            reasonCodes: ['social_engineering_text'],
          },
        ]}
      >
        <DecisionBadge />
      </DeepFraudRoot>,
    );

    expect(markup).toContain('data-decision="step_up"');
    expect(markup).toContain('Step up');
  });

  it('renders block decisions and custom classes', () => {
    const markup = renderToStaticMarkup(
      <DeepFraudRoot
        userId="user-1"
        consent="behavioral"
        initialFactors={[
          {
            kind: 'visual_challenge',
            contribution: 50,
            maxContribution: 50,
            status: 'ok',
            reasonCodes: ['face_count_gt_one'],
          },
          {
            kind: 'phishing_text_dom',
            contribution: 60,
            maxContribution: 60,
            status: 'ok',
            reasonCodes: ['social_engineering_text'],
          },
        ]}
      >
        <DecisionBadge className="custom-badge" />
      </DeepFraudRoot>,
    );

    expect(markup).toContain('custom-badge');
    expect(markup).toContain('data-decision="block"');
    expect(markup).toContain('Block');
  });
});
