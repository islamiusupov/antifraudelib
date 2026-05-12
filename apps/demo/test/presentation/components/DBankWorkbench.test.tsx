import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DBankWorkbench } from '../../../src/presentation/components/DBankWorkbench';
import type { DemoWorkbenchConfigEntity } from '../../../src/domain/entities/DemoWorkbenchConfigEntity';

describe('DBankWorkbench', () => {
  it('renders D-bank on the left and antifraud result UI on the right', () => {
    const markup = renderToStaticMarkup(<DBankWorkbench config={config} />);

    expect(markup).toContain('src="/d-bank/index.html"');
    expect(markup).toContain('title="D-bank demo"');
    expect(markup).toContain('deepfraud-demo-workbench__result');
    expect(markup).toContain('data-dbank-event-count="0"');
    expect(markup).toContain('data-decision="step_up"');
    expect(markup).toContain('deepfraud-visual-challenge-gate');
    expect(markup).toContain('copy_paste_recipient');
    expect(markup).toContain('new_recipient_in_cooldown');
  });
});

const config: DemoWorkbenchConfigEntity = {
  userId: 'demo-user',
  consent: 'behavioral',
  dBank: {
    packageName: 'd-bank',
    distPath: 'C:/repo/antifraud/node_modules/d-bank/dist',
    indexHtmlPath: 'C:/repo/antifraud/node_modules/d-bank/dist/index.html',
    routePrefix: '/d-bank',
    iframePath: '/d-bank/index.html',
  },
  initialFactors: [
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
  ],
};
