import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoApp } from './presentation/components/DemoApp';

export type DemoRootEntity = {
  render(node: ReactNode): void;
};

export type DemoRootCreating = (container: Element) => DemoRootEntity;

export function mountDemoApp(
  container: Element | null = document.getElementById('root'),
  createRootImpl: DemoRootCreating = createRoot,
): void {
  if (container === null) {
    throw new Error('Missing #root demo container');
  }

  createRootImpl(container).render(<DemoApp />);
}

if (typeof document !== 'undefined') {
  const container = document.getElementById('root');
  if (container !== null) {
    mountDemoApp(container);
  }
}
