import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DemoApp } from '../../../src/presentation/components/DemoApp';

describe('DemoApp', () => {
  it('renders the D-bank workbench with browser asset paths', () => {
    const markup = renderToStaticMarkup(<DemoApp />);

    expect(markup).toContain('src="/d-bank/index.html"');
    expect(markup).toContain('deepfraud-demo-workbench__result');
    expect(markup).toContain('deepfraud-risk-meter');
  });
});
