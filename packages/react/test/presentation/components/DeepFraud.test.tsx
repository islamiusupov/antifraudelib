import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeepFraud } from '../../../src/presentation/components/DeepFraud';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';

describe('DeepFraud', () => {
  it('renders wrapped bank UI children without adding visible markup', () => {
    expect(
      renderToStaticMarkup(
        <DeepFraudRoot userId="user-1" consent="behavioral">
          <DeepFraud scope="transaction" factors={[]}>
            <button>Pay</button>
          </DeepFraud>
        </DeepFraudRoot>,
      ),
    ).toBe('<button>Pay</button>');
  });
});
