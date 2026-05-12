export type WarningDwellObservationEntity = {
  kind: 'warning_shown' | 'warning_confirmed' | 'warning_scrolled';
  atMs: number;
  metadata?: Record<string, unknown>;
};
