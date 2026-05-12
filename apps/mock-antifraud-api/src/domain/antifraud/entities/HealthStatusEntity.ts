export type HealthStatusEntity = {
  status: 'ok' | 'degraded' | 'down';
  factors: Record<string, 'ok' | 'degraded' | 'down'>;
  version: string;
};
