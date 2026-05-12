import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';
import { useDeepFraud } from '../../../src/presentation/hooks/useDeepFraud';

describe('useDeepFraud', () => {
  it('returns state from DeepFraudRoot context', () => {
    function Probe() {
      const antifraud = useDeepFraud();
      return <span>{`${antifraud.userId}:${antifraud.assessment.decision.level}`}</span>;
    }

    expect(
      renderToStaticMarkup(
        <DeepFraudRoot userId="user-1" consent="behavioral">
          <Probe />
        </DeepFraudRoot>,
      ),
    ).toBe('<span>user-1:allow</span>');
  });

  it('throws when used outside DeepFraudRoot', () => {
    function Probe() {
      useDeepFraud();
      return <span />;
    }

    expect(() => renderToStaticMarkup(<Probe />)).toThrow('useDeepFraud must be used inside DeepFraudRoot');
  });
});
