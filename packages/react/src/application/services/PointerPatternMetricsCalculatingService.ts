import type { PointerMovementSampleEntity } from '../../domain/live/entities/PointerMovementSampleEntity';

export type PointerSegment = {
  distance: number;
  elapsedMs: number;
  speed: number;
  angle: number;
};

export type PointerPatternMetrics = {
  sampleCount: number;
  segmentCount: number;
  pathDistance: number;
  directDistance: number;
  pathEfficiency: number;
  averageStepPx: number;
  speedCv: number;
  accelerationCv: number;
  angleChangeCv: number;
  directionChangeRatio: number;
  directionSignChangeRatio: number;
  maxLineDeviationPx: number;
  boundingWidth: number;
  boundingHeight: number;
};

export class PointerPatternMetricsCalculatingService {
  segments(movements: PointerMovementSampleEntity[]): PointerSegment[] {
    const segments: PointerSegment[] = [];
    for (let index = 1; index < movements.length; index += 1) {
      const previous = movements[index - 1];
      const current = movements[index];
      const elapsedMs = current.atMs - previous.atMs;
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (elapsedMs <= 0 || distance === 0) continue;
      segments.push({
        distance,
        elapsedMs,
        speed: distance / elapsedMs,
        angle: Math.atan2(dy, dx),
      });
    }
    return segments;
  }

  metrics(movements: PointerMovementSampleEntity[], segments: PointerSegment[]): PointerPatternMetrics {
    const distances = segments.map((segment) => segment.distance);
    const speeds = segments.map((segment) => segment.speed);
    const accelerations = this.differences(speeds);
    const angleChanges = this.angleChanges(segments);
    const largeAngleChanges = angleChanges.filter((angleChange) => Math.abs(angleChange) > 0.9).length;
    const directionSignChanges = this.signChanges(angleChanges);
    const pathDistance = distances.reduce((sum, distance) => sum + distance, 0);
    const directDistance = this.directDistance(movements);
    const boundingBox = this.boundingBox(movements);

    return {
      sampleCount: movements.length,
      segmentCount: segments.length,
      pathDistance,
      directDistance,
      pathEfficiency: pathDistance > 0 ? directDistance / pathDistance : 0,
      averageStepPx: this.average(distances),
      speedCv: this.coefficientOfVariation(speeds),
      accelerationCv: this.coefficientOfVariation(accelerations.map((value) => Math.abs(value))),
      angleChangeCv: this.coefficientOfVariation(angleChanges.map((value) => Math.abs(value))),
      directionChangeRatio: angleChanges.length > 0 ? largeAngleChanges / angleChanges.length : 0,
      directionSignChangeRatio: angleChanges.length > 0 ? directionSignChanges / angleChanges.length : 0,
      maxLineDeviationPx: this.maxLineDeviation(movements),
      boundingWidth: boundingBox.width,
      boundingHeight: boundingBox.height,
    };
  }

  private directDistance(movements: PointerMovementSampleEntity[]): number {
    if (movements.length < 2) return 0;
    const first = movements[0];
    const last = movements[movements.length - 1];
    return Math.hypot(last.x - first.x, last.y - first.y);
  }

  private boundingBox(movements: PointerMovementSampleEntity[]): { width: number; height: number } {
    if (movements.length === 0) return { width: 0, height: 0 };
    const xs = movements.map((movement) => movement.x);
    const ys = movements.map((movement) => movement.y);
    return {
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  private maxLineDeviation(movements: PointerMovementSampleEntity[]): number {
    if (movements.length < 3) return 0;
    const first = movements[0];
    const last = movements[movements.length - 1];
    const lineLength = Math.hypot(last.x - first.x, last.y - first.y);
    if (lineLength === 0) return 0;
    return Math.max(...movements.map((movement) => (
      Math.abs((last.x - first.x) * (first.y - movement.y) - (first.x - movement.x) * (last.y - first.y)) /
      lineLength
    )));
  }

  private differences(values: number[]): number[] {
    const differences: number[] = [];
    for (let index = 1; index < values.length; index += 1) {
      differences.push(values[index] - values[index - 1]);
    }
    return differences;
  }

  private angleChanges(segments: PointerSegment[]): number[] {
    const changes: number[] = [];
    for (let index = 1; index < segments.length; index += 1) {
      changes.push(this.normalizeAngle(segments[index].angle - segments[index - 1].angle));
    }
    return changes;
  }

  private normalizeAngle(angle: number): number {
    let normalized = angle;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    while (normalized < -Math.PI) normalized += Math.PI * 2;
    return normalized;
  }

  private signChanges(values: number[]): number {
    let changes = 0;
    let previousSign = 0;
    values.forEach((value) => {
      const sign = Math.abs(value) < 0.05 ? 0 : Math.sign(value);
      if (sign !== 0 && previousSign !== 0 && sign !== previousSign) changes += 1;
      if (sign !== 0) previousSign = sign;
    });
    return changes;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private coefficientOfVariation(values: number[]): number {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    if (finiteValues.length === 0) return 0;
    const mean = this.average(finiteValues);
    if (Math.abs(mean) < 0.00001) return 0;
    const variance = this.average(finiteValues.map((value) => (value - mean) ** 2));
    return Math.sqrt(variance) / Math.abs(mean);
  }
}
