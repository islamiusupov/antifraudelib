import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { mountDemoApp, type DemoRootEntity } from '../src/main';

describe('mountDemoApp', () => {
  it('renders the demo app into the provided container', () => {
    const container = {} as Element;
    const renderedNodes: ReactNode[] = [];

    mountDemoApp(container, (receivedContainer): DemoRootEntity => {
      expect(receivedContainer).toBe(container);
      return {
        render: (node) => renderedNodes.push(node),
      };
    });

    expect(renderedNodes).toHaveLength(1);
  });

  it('fails when the root container is missing', () => {
    expect(() => mountDemoApp(null, () => ({ render: () => undefined }))).toThrow('Missing #root demo container');
  });
});
