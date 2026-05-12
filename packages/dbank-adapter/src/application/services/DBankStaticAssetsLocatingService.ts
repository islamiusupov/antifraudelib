export type DBankStaticAssetsLocation = {
  packageName: 'd-bank';
  distPath: string;
  indexHtmlPath: string;
  routePrefix: string;
  iframePath: string;
};

export class DBankStaticAssetsLocatingService {
  locate(workspaceRoot: string, routePrefix = '/d-bank'): DBankStaticAssetsLocation {
    const normalizedWorkspaceRoot = this.normalizePath(workspaceRoot).replace(/\/+$/, '');
    const normalizedRoutePrefix = `/${routePrefix.replace(/^\/+|\/+$/g, '')}`;
    const distPath = `${normalizedWorkspaceRoot}/node_modules/d-bank/dist`;

    return {
      packageName: 'd-bank',
      distPath,
      indexHtmlPath: `${distPath}/index.html`,
      routePrefix: normalizedRoutePrefix,
      iframePath: `${normalizedRoutePrefix}/index.html`,
    };
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }
}
