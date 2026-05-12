import { useMemo } from 'react';
import { DemoBrowserConfigBuildingService } from '../../application/services/DemoBrowserConfigBuildingService';
import { DBankWorkbench } from './DBankWorkbench';

export function DemoApp() {
  const config = useMemo(
    () =>
      new DemoBrowserConfigBuildingService().build({
        routePrefix: resolveDBankRoutePrefix(),
      }),
    [],
  );

  return <DBankWorkbench config={config} />;
}

function resolveDBankRoutePrefix(): string {
  if (typeof window === 'undefined') return '/d-bank';

  const pathname = window.location.pathname;
  const basePath = pathname.endsWith('/') ? pathname : pathname.replace(/\/[^/]*$/, '/');
  const normalizedBasePath = `/${basePath.replace(/^\/+|\/+$/g, '')}`;

  return normalizedBasePath === '/' ? '/d-bank' : `${normalizedBasePath}/d-bank`;
}
