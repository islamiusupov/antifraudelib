export type HealthStatus = {
  status: 'ok' | 'degraded' | 'down';
  factors: Record<string, 'ok' | 'degraded' | 'down'>;
  version: string;
};
