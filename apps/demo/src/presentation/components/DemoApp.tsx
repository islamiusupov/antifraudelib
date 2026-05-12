import { useMemo } from 'react';
import { DemoBrowserConfigBuildingService } from '../../application/services/DemoBrowserConfigBuildingService';
import { DBankWorkbench } from './DBankWorkbench';

export function DemoApp() {
  const config = useMemo(() => new DemoBrowserConfigBuildingService().build(), []);

  return <DBankWorkbench config={config} />;
}
