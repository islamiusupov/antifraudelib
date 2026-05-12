import type { PointerClickSampleEntity } from '../../domain/live/entities/PointerClickSampleEntity';
import type { PointerMovementSampleEntity, PointerTargetRectEntity } from '../../domain/live/entities/PointerMovementSampleEntity';
import type { PointerPatternVerdictEntity } from '../../domain/live/entities/PointerPatternVerdictEntity';
import type { LiveInteractionDomEventEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';
import { PointerPatternAnalyzingService, type PointerPatternCollectingState } from './PointerPatternAnalyzingService';

export type PointerMovementCollectingContext = {
  maxTouchPoints?: number;
  pointerJumpThresholdPx?: number;
};

export class PointerMovementCollectingService {
  constructor(private readonly pointerPatternAnalyzingService = new PointerPatternAnalyzingService()) {}

  createState(): PointerPatternCollectingState {
    return this.pointerPatternAnalyzingService.createState();
  }

  recordPointerMove(
    state: PointerPatternCollectingState,
    event: LiveInteractionDomEventEntity,
    atMs: number,
    context: PointerMovementCollectingContext = {},
  ): PointerPatternVerdictEntity | null {
    if (event.clientX === undefined || event.clientY === undefined) return null;
    return this.pointerPatternAnalyzingService.recordPointerMove(
      state,
      this.pointerMovementSample(event, atMs),
      context,
    );
  }

  recordPointerDown(state: PointerPatternCollectingState, atMs: number): void {
    this.pointerPatternAnalyzingService.recordPointerDown(state, { atMs });
  }

  recordPointerUp(state: PointerPatternCollectingState, atMs: number): void {
    this.pointerPatternAnalyzingService.recordPointerUp(state, { atMs });
  }

  recordClick(
    state: PointerPatternCollectingState,
    event: LiveInteractionDomEventEntity,
    atMs: number,
    context: PointerMovementCollectingContext = {},
  ): PointerPatternVerdictEntity | null {
    return this.pointerPatternAnalyzingService.recordClick(
      state,
      this.pointerClickSample(event, atMs),
      context,
    );
  }

  recordFormInteraction(
    state: PointerPatternCollectingState,
    atMs: number,
    formRequiresReading: boolean,
  ): void {
    this.pointerPatternAnalyzingService.recordFormInteraction(state, atMs, formRequiresReading);
  }

  recordFormSubmit(state: PointerPatternCollectingState, atMs: number): PointerPatternVerdictEntity | null {
    return this.pointerPatternAnalyzingService.recordFormSubmit(state, atMs);
  }

  private pointerMovementSample(event: LiveInteractionDomEventEntity, atMs: number): PointerMovementSampleEntity {
    return {
      x: event.clientX ?? 0,
      y: event.clientY ?? 0,
      atMs,
      pointerType: event.pointerType,
      buttons: event.buttons,
      movementX: event.movementX,
      movementY: event.movementY,
      targetText: this.targetDescriptor(event.target),
      targetRect: this.pointerTargetRect(event.target),
      isTrusted: event.isTrusted,
    };
  }

  private pointerClickSample(event: LiveInteractionDomEventEntity, atMs: number): PointerClickSampleEntity {
    return {
      x: event.clientX ?? 0,
      y: event.clientY ?? 0,
      atMs,
      pointerType: event.pointerType,
      targetText: this.targetDescriptor(event.target),
      targetRect: this.pointerTargetRect(event.target),
    };
  }

  private pointerTargetRect(target: unknown): PointerTargetRectEntity | undefined {
    if (target === null || typeof target !== 'object') return undefined;
    const getBoundingClientRect = (target as Record<string, unknown>).getBoundingClientRect;
    if (typeof getBoundingClientRect !== 'function') return undefined;
    const rect = getBoundingClientRect.call(target) as Record<string, unknown>;
    const left = rect.left;
    const top = rect.top;
    const width = rect.width;
    const height = rect.height;
    if (
      typeof left !== 'number' ||
      typeof top !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      !Number.isFinite(left) ||
      !Number.isFinite(top) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return undefined;
    }
    return { left, top, width, height };
  }

  private targetDescriptor(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const record = target as Record<string, unknown>;
    return [
      record.name,
      record.type,
      record.id,
      record.placeholder,
      record.ariaLabel,
      record.textContent,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  }
}
