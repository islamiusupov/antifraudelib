import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';
import { useDeepFraud } from '../../../src/presentation/hooks/useDeepFraud';

describe('DeepFraudRoot', () => {
  it('provides an initial scored assessment to children', () => {
    function Probe() {
      const antifraud = useDeepFraud();
      return <span>{`${antifraud.assessment.score}:${antifraud.assessment.decision.level}`}</span>;
    }

    expect(
      renderToStaticMarkup(
        <DeepFraudRoot
          userId="user-1"
          consent="behavioral"
          initialFactors={[
            {
              kind: 'concurrent_media',
              contribution: 35,
              maxContribution: 35,
              status: 'ok',
              reasonCodes: ['concurrent_media_active'],
            },
          ]}
        >
          <Probe />
        </DeepFraudRoot>,
      ),
    ).toBe('<span>35:monitor</span>');
  });
});
