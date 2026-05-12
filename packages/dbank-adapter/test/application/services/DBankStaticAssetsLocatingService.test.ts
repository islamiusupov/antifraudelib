import { describe, expect, it } from 'vitest';
import { DBankStaticAssetsLocatingService } from '../../../src/application/services/DBankStaticAssetsLocatingService';

describe('DBankStaticAssetsLocatingService', () => {
  it('locates the installed D-bank static dist directory from a workspace root', () => {
    const service = new DBankStaticAssetsLocatingService();

    expect(service.locate('C:\\repo\\antifraud')).toEqual({
      packageName: 'd-bank',
      distPath: 'C:/repo/antifraud/node_modules/d-bank/dist',
      indexHtmlPath: 'C:/repo/antifraud/node_modules/d-bank/dist/index.html',
      routePrefix: '/d-bank',
      iframePath: '/d-bank/index.html',
    });
  });

  it('normalizes trailing slashes and custom route prefixes', () => {
    const service = new DBankStaticAssetsLocatingService();

    expect(service.locate('/repo/antifraud/', 'bank-ui/')).toMatchObject({
      distPath: '/repo/antifraud/node_modules/d-bank/dist',
      routePrefix: '/bank-ui',
      iframePath: '/bank-ui/index.html',
    });
  });
});
