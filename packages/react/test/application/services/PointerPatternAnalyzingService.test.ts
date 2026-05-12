import { describe, expect, it } from 'vitest';
import { PointerPatternAnalyzingService } from '../../../src/application/services/PointerPatternAnalyzingService';
import type { PointerClickSampleEntity } from '../../../src/domain/live/entities/PointerClickSampleEntity';
import type { PointerPatternAnalysisInputEntity } from '../../../src/domain/live/entities/PointerPatternAnalysisInputEntity';
import type { PointerMovementSampleEntity } from '../../../src/domain/live/entities/PointerMovementSampleEntity';

describe('PointerPatternAnalyzingService', () => {
  it.each([
    {
      scenario: 'PTR-01 linear RAT auto-fill',
      input: {
        movements: [
          movement(0, 0, 0),
          movement(50, 0, 50),
          movement(100, 0, 100),
          movement(150, 0, 150),
          movement(200, 0, 200),
        ],
      },
      expectedLevel: 'step_up',
      expectedReason: 'pointer_linear_rat_autofill',
    },
    {
      scenario: 'PTR-02 exact button hit without hover exploration',
      input: {
        movements: [],
        clicks: [
          click(120, 110, 100, {
            targetText: 'Confirm',
            targetRect: rect(100, 100, 40, 20),
          }),
        ],
      },
      expectedLevel: 'step_up',
      expectedReason: 'pointer_exact_hit_no_hover_exploration',
    },
    {
      scenario: 'PTR-03 constant cursor speed automation',
      input: {
        movements: [
          movement(0, 0, 0),
          movement(30, 0, 50),
          movement(60, 10, 100),
          movement(90, 10, 150),
          movement(120, 20, 200),
          movement(150, 20, 250),
        ],
      },
      expectedLevel: 'step_up',
      expectedReason: 'pointer_constant_speed_automation',
    },
    {
      scenario: 'PTR-04 teleport jump without intermediate events',
      input: {
        movements: [
          movement(0, 0, 0),
          movement(250, 0, 50),
        ],
      },
      expectedLevel: 'step_up',
      expectedReason: 'pointer_teleport_jump',
    },
    {
      scenario: 'PTR-05 missing natural idle drift',
      input: {
        movements: [
          movement(0, 0, 0),
          movement(40, 0, 2000),
          movement(80, 10, 2050),
        ],
      },
      expectedLevel: 'monitor',
      expectedReason: 'pointer_idle_drift_missing',
    },
    {
      scenario: 'PTR-06 excessively smooth Bezier-like bot curve',
      input: {
        movements: [
          movement(0, 0, 0),
          movement(20, 15, 50),
          movement(40, 28, 100),
          movement(60, 39, 150),
          movement(80, 48, 200),
          movement(100, 55, 250),
          movement(120, 60, 300),
          movement(140, 63, 350),
          movement(160, 64, 400),
        ],
      },
      expectedLevel: 'step_up',
      expectedReason: 'pointer_smooth_bezier_bot',
    },
    {
      scenario: 'PTR-07 chaotic non-human adversarial bot movement',
      input: {
        movements: [
          movement(0, 0, 0),
          movement(100, 0, 50),
          movement(105, 5, 100),
          movement(20, 90, 150),
          movement(140, 20, 200),
          movement(145, 25, 250),
          movement(10, 130, 300),
          movement(160, 30, 350),
        ],
      },
      expectedLevel: 'step_up',
      expectedReason: 'pointer_chaotic_adversarial_bot',
    },
    {
      scenario: 'PTR-08 double-clicks with identical durations',
      input: {
        movements: [],
        clicks: [
          click(10, 10, 100, { durationMs: 80 }),
          click(12, 11, 300, { durationMs: 80 }),
        ],
      },
      expectedLevel: 'monitor',
      expectedReason: 'pointer_double_click_identical_duration',
    },
    {
      scenario: 'PTR-09 natural curved trajectory with micro jitter',
      input: {
        movements: [
          movement(0, 0, 0),
          movement(25, 10, 80),
          movement(45, 28, 170),
          movement(70, 35, 260),
          movement(95, 62, 390),
          movement(122, 70, 470),
          movement(150, 96, 620),
          movement(185, 103, 730),
        ],
      },
      expectedLevel: 'allow',
      expectedReason: 'pointer_natural_curve_micro_jitter',
    },
    {
      scenario: 'PTR-10 hover-explore-click human pattern',
      input: {
        movements: [],
        clicks: [
          click(145, 120, 100, {
            hoverSampleCount: 4,
            hoveredTargetCount: 2,
            targetRect: rect(120, 100, 60, 40),
          }),
        ],
      },
      expectedLevel: 'allow',
      expectedReason: 'pointer_hover_explore_click_human',
    },
    {
      scenario: 'PTR-11 Fitts law slowdown near target',
      input: {
        movements: [
          movement(0, 100, 0),
          movement(80, 100, 80),
          movement(130, 100, 180),
          movement(160, 100, 320),
          movement(180, 100, 520),
          movement(195, 100, 820),
        ],
        clicks: [
          click(198, 100, 900, {
            hoverSampleCount: 2,
            targetRect: rect(180, 90, 40, 20),
          }),
        ],
      },
      expectedLevel: 'allow',
      expectedReason: 'pointer_fitts_law_slowdown',
    },
    {
      scenario: 'PTR-12 touchpad human pattern',
      input: {
        deviceType: 'touchpad',
        movements: [
          movement(0, 0, 0),
          movement(50, 0, 50),
          movement(100, 0, 100),
          movement(150, 0, 150),
          movement(200, 0, 200),
        ],
      },
      expectedLevel: 'allow',
      expectedReason: 'pointer_touchpad_human_pattern',
    },
    {
      scenario: 'PTR-13 touch-only device not applicable',
      input: {
        movements: [],
        maxTouchPoints: 5,
      },
      expectedLevel: 'allow',
      expectedReason: 'pointer_touch_only_not_applicable',
    },
    {
      scenario: 'PTR-14 tremor false positive risk',
      input: {
        movements: [
          movement(50, 50, 0),
          movement(55, 51, 80),
          movement(49, 53, 160),
          movement(56, 49, 240),
          movement(48, 52, 320),
          movement(55, 54, 400),
          movement(50, 48, 480),
          movement(57, 51, 560),
          movement(49, 55, 640),
          movement(54, 49, 720),
        ],
      },
      expectedLevel: 'monitor',
      expectedReason: 'pointer_tremor_false_positive_risk',
    },
    {
      scenario: 'PTR-15 trackball split baseline',
      input: {
        deviceType: 'trackball',
        movements: [movement(0, 0, 0), movement(100, 10, 100)],
      },
      expectedLevel: 'monitor',
      expectedReason: 'pointer_trackball_split_baseline',
    },
    {
      scenario: 'PTR-16 stylus smooth split baseline',
      input: {
        movements: [
          movement(0, 0, 0, { pointerType: 'pen' }),
          movement(30, 15, 50, { pointerType: 'pen' }),
          movement(60, 25, 100, { pointerType: 'pen' }),
        ],
      },
      expectedLevel: 'monitor',
      expectedReason: 'pointer_stylus_smooth_split_baseline',
    },
  ] as Array<{
    scenario: string;
    input: PointerPatternAnalysisInputEntity;
    expectedLevel: string;
    expectedReason: string;
  }>)('classifies $scenario', ({ input, expectedLevel, expectedReason }) => {
    const service = new PointerPatternAnalyzingService();

    expect(service.analyze(input)).toMatchObject({
      level: expectedLevel,
      reasonCode: expectedReason,
      reasonCodes: [expectedReason],
    });
  });

  it('emits each risk verdict once while collecting live samples', () => {
    const service = new PointerPatternAnalyzingService();
    const state = service.createState();

    expect(service.recordPointerMove(state, movement(0, 0, 0))).toBeNull();
    expect(service.recordPointerMove(state, movement(250, 0, 50))?.reasonCode).toBe('pointer_teleport_jump');
    expect(service.recordPointerMove(state, movement(500, 0, 100))).toBeNull();
  });
});

function movement(
  x: number,
  y: number,
  atMs: number,
  options: Partial<PointerMovementSampleEntity> = {},
): PointerMovementSampleEntity {
  return { x, y, atMs, ...options };
}

function click(
  x: number,
  y: number,
  atMs: number,
  options: Partial<PointerClickSampleEntity> = {},
): PointerClickSampleEntity {
  return { x, y, atMs, ...options };
}

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height };
}
