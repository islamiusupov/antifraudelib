import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeepFraudRoot } from '../../../src/presentation/components/DeepFraudRoot';
import { ReasonCodeList } from '../../../src/presentation/components/ReasonCodeList';

describe('ReasonCodeList', () => {
  it('renders ordered reason codes from the current assessment', () => {
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
        <ReasonCodeList />
      </DeepFraudRoot>,
    );

    expect(markup.indexOf('copy_paste_recipient')).toBeLessThan(markup.indexOf('new_recipient_in_cooldown'));
    expect(markup).toContain('data-factor-kind="copy_paste_recipient"');
    expect(markup).toContain('+40');
  });

  it('renders an empty state when there are no risk reasons', () => {
    expect(
      renderToStaticMarkup(
        <DeepFraudRoot userId="user-1" consent="behavioral">
          <ReasonCodeList />
        </DeepFraudRoot>,
      ),
    ).toContain('No risk reasons');
  });
});
