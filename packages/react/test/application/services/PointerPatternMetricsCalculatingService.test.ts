import { describe, expect, it } from 'vitest';
import { PointerPatternMetricsCalculatingService } from '../../../src/application/services/PointerPatternMetricsCalculatingService';

describe('PointerPatternMetricsCalculatingService', () => {
  it('calculates movement segments and path metrics', () => {
    const service = new PointerPatternMetricsCalculatingService();
    const movements = [
      { x: 0, y: 0, atMs: 0 },
      { x: 30, y: 40, atMs: 100 },
      { x: 60, y: 40, atMs: 200 },
    ];

    const segments = service.segments(movements);
    const metrics = service.metrics(movements, segments);

    expect(segments.map((segment) => [segment.distance, segment.elapsedMs, segment.speed])).toEqual([
      [50, 100, 0.5],
      [30, 100, 0.3],
    ]);
    expect(metrics).toMatchObject({
      sampleCount: 3,
      segmentCount: 2,
      pathDistance: 80,
      directDistance: expect.closeTo(72.111, 3),
      averageStepPx: 40,
      boundingWidth: 60,
      boundingHeight: 40,
    });
  });
});
