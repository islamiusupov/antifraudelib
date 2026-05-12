import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';
import { VisualChallengeGate } from '../../../src/presentation/components/VisualChallengeGate';

describe('VisualChallengeGate', () => {
  it('renders a camera challenge gate for suspicious decisions', () => {
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
        <VisualChallengeGate />
      </DeepFraudRoot>,
    );

    expect(markup).toContain('deepfraud-visual-challenge-gate');
    expect(markup).toContain('data-camera-state="idle"');
    expect(markup).toContain('Verify camera');
  });

  it('does not render while risk is below step-up threshold', () => {
    const markup = renderToStaticMarkup(
      <DeepFraudRoot userId="user-1" consent="behavioral">
        <VisualChallengeGate />
      </DeepFraudRoot>,
    );

    expect(markup).toBe('');
  });
});
