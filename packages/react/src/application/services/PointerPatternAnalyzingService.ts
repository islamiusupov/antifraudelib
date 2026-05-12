import type { PointerClickSampleEntity } from '../../domain/live/entities/PointerClickSampleEntity';
import type { PointerPatternAnalysisInputEntity } from '../../domain/live/entities/PointerPatternAnalysisInputEntity';
import type { PointerPatternVerdictEntity } from '../../domain/live/entities/PointerPatternVerdictEntity';
import type { PointerMovementSampleEntity, PointerTargetRectEntity } from '../../domain/live/entities/PointerMovementSampleEntity';
import { PointerPatternMetricsCalculatingService, type PointerPatternMetrics, type PointerSegment } from './PointerPatternMetricsCalculatingService';

export type PointerPatternCollectingState = {
  movements: PointerMovementSampleEntity[];
  clicks: PointerClickSampleEntity[];
  emittedReasonCodes: Set<string>;
  pointerDownAtMs?: number;
  lastClickDurationMs?: number;
  firstFormInteractionAtMs?: number;
  formRequiresReading?: boolean;
  fastFormCompletionEmitted?: boolean;
  lastRiskVerdict?: PointerPatternVerdictEntity;
};

const DEFAULT_POINTER_JUMP_THRESHOLD_PX = 200;
const DEFAULT_IDLE_DRIFT_MINIMUM_GAP_MS = 1500;
const MAX_RETAINED_MOVEMENTS = 80;
const MAX_RETAINED_CLICKS = 8;

export class PointerPatternAnalyzingService {
  constructor(private readonly pointerPatternMetricsCalculatingService = new PointerPatternMetricsCalculatingService()) {}

  createState(): PointerPatternCollectingState {
    return {
      movements: [],
      clicks: [],
      emittedReasonCodes: new Set<string>(),
    };
  }

  recordPointerMove(
    state: PointerPatternCollectingState,
    sample: PointerMovementSampleEntity,
    context: Pick<PointerPatternAnalysisInputEntity, 'maxTouchPoints' | 'pointerJumpThresholdPx'> = {},
  ): PointerPatternVerdictEntity | null {
    state.movements = [...state.movements, sample].slice(-MAX_RETAINED_MOVEMENTS);
    return this.emitRiskOnce(state, this.analyze({
      movements: state.movements,
      clicks: state.clicks,
      maxTouchPoints: context.maxTouchPoints,
      pointerJumpThresholdPx: context.pointerJumpThresholdPx,
    }));
  }

  recordPointerDown(state: PointerPatternCollectingState, sample: Pick<PointerMovementSampleEntity, 'atMs'>): void {
    state.pointerDownAtMs = sample.atMs;
  }

  recordPointerUp(state: PointerPatternCollectingState, sample: Pick<PointerMovementSampleEntity, 'atMs'>): void {
    if (state.pointerDownAtMs === undefined) return;
    state.lastClickDurationMs = Math.max(sample.atMs - state.pointerDownAtMs, 0);
    state.pointerDownAtMs = undefined;
  }

  recordClick(
    state: PointerPatternCollectingState,
    click: PointerClickSampleEntity,
    context: Pick<PointerPatternAnalysisInputEntity, 'maxTouchPoints' | 'pointerJumpThresholdPx'> = {},
  ): PointerPatternVerdictEntity | null {
    const enrichedClick = this.withHoverMetrics(state, {
      ...click,
      durationMs: click.durationMs ?? state.lastClickDurationMs,
    });
    state.lastClickDurationMs = undefined;
    state.clicks = [...state.clicks, enrichedClick].slice(-MAX_RETAINED_CLICKS);

    return this.emitRiskOnce(state, this.analyze({
      movements: state.movements,
      clicks: state.clicks,
      maxTouchPoints: context.maxTouchPoints,
      pointerJumpThresholdPx: context.pointerJumpThresholdPx,
      formDurationMs: this.formDurationMs(state, click.atMs),
      formRequiresReading: state.formRequiresReading,
    }));
  }

  recordFormInteraction(
    state: PointerPatternCollectingState,
    atMs: number,
    formRequiresReading = false,
  ): void {
    state.firstFormInteractionAtMs = state.firstFormInteractionAtMs ?? atMs;
    state.formRequiresReading = state.formRequiresReading === true || formRequiresReading;
  }

  recordFormSubmit(state: PointerPatternCollectingState, atMs: number): PointerPatternVerdictEntity | null {
    const formDurationMs = this.formDurationMs(state, atMs);
    if (
      state.lastRiskVerdict === undefined ||
      state.fastFormCompletionEmitted === true ||
      state.formRequiresReading !== true ||
      formDurationMs === undefined ||
      formDurationMs >= 5000
    ) {
      return null;
    }

    state.fastFormCompletionEmitted = true;
    const verdict = {
      ...state.lastRiskVerdict,
      metadata: {
        ...state.lastRiskVerdict.metadata,
        formDurationMs,
        formRequiresReading: true,
      },
    };
    state.lastRiskVerdict = verdict;
    return verdict;
  }

  analyze(input: PointerPatternAnalysisInputEntity): PointerPatternVerdictEntity {
    const movements = input.movements.slice().sort((left, right) => left.atMs - right.atMs);
    const clicks = (input.clicks ?? []).slice().sort((left, right) => left.atMs - right.atMs);
    const segments = this.pointerPatternMetricsCalculatingService.segments(movements);
    const metrics = this.pointerPatternMetricsCalculatingService.metrics(movements, segments);
    const deviceType = this.deviceType(input, movements, clicks);

    if (this.isTouchOnly(input, movements, clicks, deviceType)) {
      return this.allow('pointer_touch_only_not_applicable', { maxTouchPoints: input.maxTouchPoints ?? 0 });
    }
    if (deviceType === 'touchpad') {
      return this.allow('pointer_touchpad_human_pattern', { deviceType });
    }
    if (deviceType === 'trackball') {
      return this.monitor('pointer_trackball_split_baseline', { deviceType });
    }
    if (deviceType === 'stylus' || deviceType === 'pen') {
      return this.monitor('pointer_stylus_smooth_split_baseline', { deviceType });
    }

    const doubleClick = this.identicalDoubleClick(clicks);
    if (doubleClick !== null) {
      return this.monitor('pointer_double_click_identical_duration', doubleClick);
    }

    const teleport = this.teleportSegment(segments, input.pointerJumpThresholdPx ?? DEFAULT_POINTER_JUMP_THRESHOLD_PX);
    if (teleport !== null) {
      return this.stepUp('pointer_teleport_jump', teleport);
    }

    const exactHit = this.exactHitWithoutHover(clicks);
    if (exactHit !== null) {
      return this.stepUp('pointer_exact_hit_no_hover_exploration', exactHit);
    }

    if (this.hasTremorPattern(metrics, segments)) {
      return this.monitor('pointer_tremor_false_positive_risk', {
        falsePositiveRisk: true,
        averageStepPx: metrics.averageStepPx,
        directionChangeRatio: metrics.directionChangeRatio,
      });
    }

    const idleGap = this.idleDriftGap(segments, input.idleDriftMinimumGapMs ?? DEFAULT_IDLE_DRIFT_MINIMUM_GAP_MS);
    if (idleGap !== null) {
      return this.monitor('pointer_idle_drift_missing', idleGap);
    }

    if (this.hasChaoticPattern(metrics)) {
      return this.stepUp('pointer_chaotic_adversarial_bot', {
        pathEfficiency: metrics.pathEfficiency,
        directionChangeRatio: metrics.directionChangeRatio,
        speedCv: metrics.speedCv,
      });
    }

    if (this.hasFittsLawSlowdown(movements, clicks, segments)) {
      return this.allow('pointer_fitts_law_slowdown', {
        speedCv: metrics.speedCv,
        targetDistancePx: this.latestClickTargetDistance(clicks),
      });
    }

    if (this.hasHoverExploration(clicks)) {
      return this.allow('pointer_hover_explore_click_human', {
        hoverSampleCount: Math.max(...clicks.map((click) => click.hoverSampleCount ?? 0), 0),
      });
    }

    if (this.hasStrictLinearPattern(metrics, movements)) {
      return this.stepUp('pointer_linear_rat_autofill', {
        pathEfficiency: metrics.pathEfficiency,
        maxLineDeviationPx: metrics.maxLineDeviationPx,
      });
    }

    if (this.hasConstantSpeedPattern(metrics, segments)) {
      return this.stepUp('pointer_constant_speed_automation', {
        speedCv: metrics.speedCv,
        accelerationCv: metrics.accelerationCv,
      });
    }

    if (this.hasSmoothBezierPattern(metrics)) {
      return this.stepUp('pointer_smooth_bezier_bot', {
        pathEfficiency: metrics.pathEfficiency,
        angleChangeCv: metrics.angleChangeCv,
        speedCv: metrics.speedCv,
      });
    }

    return this.allow('pointer_natural_curve_micro_jitter', {
      pathEfficiency: metrics.pathEfficiency,
      directionChangeRatio: metrics.directionChangeRatio,
      speedCv: metrics.speedCv,
    });
  }

  private emitRiskOnce(
    state: PointerPatternCollectingState,
    verdict: PointerPatternVerdictEntity,
  ): PointerPatternVerdictEntity | null {
    if (verdict.level === 'allow') return null;
    if (state.emittedReasonCodes.has(verdict.reasonCode)) return null;
    state.emittedReasonCodes.add(verdict.reasonCode);
    state.lastRiskVerdict = verdict;
    return verdict;
  }

  private withHoverMetrics(
    state: PointerPatternCollectingState,
    click: PointerClickSampleEntity,
  ): PointerClickSampleEntity {
    if (click.targetRect === undefined) return click;
    const targetRect = click.targetRect;
    const recentMovements = state.movements.filter((movement) => (
      movement.atMs <= click.atMs &&
      click.atMs - movement.atMs <= 1200
    ));
    const hoverMovements = recentMovements.filter((movement) => this.isInsideRect(movement, targetRect));
    const targetTexts = recentMovements
      .map((movement) => movement.targetText)
      .filter((value): value is string => value !== undefined && value.trim() !== '');

    return {
      ...click,
      hoverSampleCount: click.hoverSampleCount ?? hoverMovements.length,
      hoveredTargetCount: click.hoveredTargetCount ?? new Set(targetTexts).size,
    };
  }

  private isInsideRect(sample: PointerMovementSampleEntity, rect: PointerTargetRectEntity): boolean {
    return sample.x >= rect.left &&
      sample.x <= rect.left + rect.width &&
      sample.y >= rect.top &&
      sample.y <= rect.top + rect.height;
  }

  private formDurationMs(state: PointerPatternCollectingState, atMs: number): number | undefined {
    if (state.firstFormInteractionAtMs === undefined) return undefined;
    return Math.max(atMs - state.firstFormInteractionAtMs, 0);
  }

  private deviceType(
    input: PointerPatternAnalysisInputEntity,
    movements: PointerMovementSampleEntity[],
    clicks: PointerClickSampleEntity[],
  ): string | undefined {
    return input.deviceType ??
      movements.find((movement) => movement.inputDeviceType !== undefined)?.inputDeviceType ??
      clicks.find((click) => click.inputDeviceType !== undefined)?.inputDeviceType ??
      movements.find((movement) => movement.pointerType !== undefined)?.pointerType ??
      clicks.find((click) => click.pointerType !== undefined)?.pointerType;
  }

  private isTouchOnly(
    input: PointerPatternAnalysisInputEntity,
    movements: PointerMovementSampleEntity[],
    clicks: PointerClickSampleEntity[],
    deviceType: string | undefined,
  ): boolean {
    if (deviceType === 'touch') return true;
    const allPointersAreTouch = [...movements, ...clicks].length > 0 &&
      [...movements, ...clicks].every((sample) => sample.pointerType === 'touch');
    return allPointersAreTouch || (movements.length === 0 && clicks.length === 0 && (input.maxTouchPoints ?? 0) > 0);
  }

  private identicalDoubleClick(clicks: PointerClickSampleEntity[]): Record<string, unknown> | null {
    for (let index = 1; index < clicks.length; index += 1) {
      const previous = clicks[index - 1];
      const current = clicks[index];
      if (previous.durationMs === undefined || current.durationMs === undefined) continue;
      if (current.atMs - previous.atMs > 500) continue;
      if (Math.abs(current.durationMs - previous.durationMs) <= 1) {
        return {
          durationMs: current.durationMs,
          intervalMs: current.atMs - previous.atMs,
        };
      }
    }
    return null;
  }

  private teleportSegment(segments: PointerSegment[], thresholdPx: number): Record<string, unknown> | null {
    const match = segments.find((segment) => segment.distance > thresholdPx && segment.elapsedMs <= 100);
    if (match === undefined) return null;
    return {
      distance: match.distance,
      elapsedMs: match.elapsedMs,
      thresholdPx,
    };
  }

  private exactHitWithoutHover(clicks: PointerClickSampleEntity[]): Record<string, unknown> | null {
    const match = clicks.find((click) => {
      const distance = this.clickTargetDistance(click);
      if (distance === null || click.targetRect === undefined) return false;
      const tolerance = Math.max(Math.min(click.targetRect.width, click.targetRect.height) * 0.08, 3);
      return distance <= tolerance &&
        (click.hoverSampleCount ?? 0) <= 1 &&
        (click.hoveredTargetCount ?? 0) <= 1;
    });
    if (match === undefined) return null;
    return {
      targetText: match.targetText,
      targetCenterDistancePx: this.clickTargetDistance(match),
      hoverSampleCount: match.hoverSampleCount ?? 0,
    };
  }

  private clickTargetDistance(click: PointerClickSampleEntity): number | null {
    if (click.targetRect === undefined) return null;
    const centerX = click.targetRect.left + click.targetRect.width / 2;
    const centerY = click.targetRect.top + click.targetRect.height / 2;
    return Math.hypot(click.x - centerX, click.y - centerY);
  }

  private latestClickTargetDistance(clicks: PointerClickSampleEntity[]): number | null {
    if (clicks.length === 0) return null;
    return this.clickTargetDistance(clicks[clicks.length - 1]);
  }

  private hasTremorPattern(metrics: PointerPatternMetrics, segments: PointerSegment[]): boolean {
    return metrics.segmentCount >= 8 &&
      metrics.averageStepPx <= 8 &&
      metrics.directionChangeRatio >= 0.45 &&
      metrics.boundingWidth <= 80 &&
      metrics.boundingHeight <= 80 &&
      segments.every((segment) => segment.distance <= 18);
  }

  private idleDriftGap(segments: PointerSegment[], minimumGapMs: number): Record<string, unknown> | null {
    const match = segments.find((segment) => segment.elapsedMs >= minimumGapMs && segment.distance > 25);
    if (match === undefined) return null;
    return {
      idleGapMs: match.elapsedMs,
      movementAfterIdlePx: match.distance,
      minimumGapMs,
    };
  }

  private hasChaoticPattern(metrics: PointerPatternMetrics): boolean {
    return metrics.segmentCount >= 7 &&
      metrics.pathDistance >= 120 &&
      metrics.pathEfficiency <= 0.55 &&
      metrics.directionChangeRatio >= 0.45 &&
      metrics.speedCv >= 0.6;
  }

  private hasFittsLawSlowdown(
    movements: PointerMovementSampleEntity[],
    clicks: PointerClickSampleEntity[],
    segments: PointerSegment[],
  ): boolean {
    if (movements.length < 5 || clicks.length === 0 || segments.length < 4) return false;
    const latestClick = clicks[clicks.length - 1];
    if (latestClick.targetRect === undefined) return false;

    const firstSpeeds = segments.slice(0, Math.max(2, Math.floor(segments.length / 2))).map((segment) => segment.speed);
    const lastSpeeds = segments.slice(-3).map((segment) => segment.speed);
    const firstAverage = this.average(firstSpeeds);
    const lastAverage = this.average(lastSpeeds);
    const slowsNearEnd = lastAverage > 0 && firstAverage > 0 && lastAverage <= firstAverage * 0.7;
    const finalPoint = movements[movements.length - 1];
    const targetCenterDistance = this.distanceToRectCenter(finalPoint, latestClick.targetRect);

    return slowsNearEnd && targetCenterDistance <= Math.max(latestClick.targetRect.width, latestClick.targetRect.height);
  }

  private distanceToRectCenter(sample: PointerMovementSampleEntity, rect: PointerTargetRectEntity): number {
    return Math.hypot(sample.x - (rect.left + rect.width / 2), sample.y - (rect.top + rect.height / 2));
  }

  private hasHoverExploration(clicks: PointerClickSampleEntity[]): boolean {
    return clicks.some((click) => (click.hoverSampleCount ?? 0) >= 3 || (click.hoveredTargetCount ?? 0) >= 2);
  }

  private hasStrictLinearPattern(
    metrics: PointerPatternMetrics,
    movements: PointerMovementSampleEntity[],
  ): boolean {
    return movements.length >= 5 &&
      metrics.pathDistance >= 120 &&
      metrics.pathEfficiency >= 0.995 &&
      metrics.maxLineDeviationPx <= 1.5;
  }

  private hasConstantSpeedPattern(
    metrics: PointerPatternMetrics,
    segments: PointerSegment[],
  ): boolean {
    return segments.length >= 5 &&
      metrics.pathDistance >= 100 &&
      metrics.speedCv <= 0.03 &&
      metrics.accelerationCv <= 0.1;
  }

  private hasSmoothBezierPattern(metrics: PointerPatternMetrics): boolean {
    return metrics.segmentCount >= 7 &&
      metrics.pathDistance >= 120 &&
      metrics.pathEfficiency >= 0.72 &&
      metrics.pathEfficiency <= 0.985 &&
      metrics.speedCv <= 0.18 &&
      metrics.angleChangeCv <= 0.35 &&
      metrics.directionSignChangeRatio <= 0.15;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private allow(reasonCode: string, metadata: Record<string, unknown>): PointerPatternVerdictEntity {
    return this.verdict('allow', reasonCode, 1, metadata);
  }

  private monitor(reasonCode: string, metadata: Record<string, unknown>): PointerPatternVerdictEntity {
    return this.verdict('monitor', reasonCode, 1, metadata);
  }

  private stepUp(reasonCode: string, metadata: Record<string, unknown>): PointerPatternVerdictEntity {
    return this.verdict('step_up', reasonCode, 1, metadata);
  }

  private verdict(
    level: PointerPatternVerdictEntity['level'],
    reasonCode: string,
    confidence: number,
    metadata: Record<string, unknown>,
  ): PointerPatternVerdictEntity {
    return {
      level,
      reasonCode,
      reasonCodes: [reasonCode],
      confidence,
      metadata,
    };
  }
}
