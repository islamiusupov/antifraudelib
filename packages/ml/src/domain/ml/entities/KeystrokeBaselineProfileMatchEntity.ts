export type KeystrokeBaselineProfileMatchEntity = {
  verdict: 'allow' | 'monitor' | 'none';
  reasonCode?: string;
  confidence: number;
  metadata: Record<string, unknown>;
};
