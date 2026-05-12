import { describe, expect, it } from 'vitest';
import { WarningDwellSignalBuildingService } from '../../../src/application/services/WarningDwellSignalBuildingService';
import type { WarningDwellObservationEntity } from '../../../src/domain/warning/entities/WarningDwellObservationEntity';

describe('WarningDwellSignalBuildingService', () => {
  it('steps up a warning confirmed after 600 ms', () => {
    const service = new WarningDwellSignalBuildingService();

    expect(
      service.build([
        observation('warning_shown', 1000),
        observation('warning_scrolled', 1300),
        observation('warning_confirmed', 1600),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'warning_dwell',
        confidence: 0.9,
        reasonCodes: ['warning_dwell_too_short'],
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 42,
        maxContribution: 42,
        reasonCodes: ['warning_skip_step_up_floor'],
      }),
    ]);
  });

  it('marks no-scroll warning dwell below the minimum dwell time', () => {
    const service = new WarningDwellSignalBuildingService();

    expect(service.build([observation('warning_shown', 0), observation('warning_confirmed', 600)]))
      .toEqual([
        expect.objectContaining({
          kind: 'warning_dwell',
          reasonCodes: ['warning_dwell_too_short', 'warning_no_scroll_dwell_too_short'],
        }),
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 42,
          reasonCodes: ['warning_skip_step_up_floor'],
        }),
      ]);
  });

  it('blocks a series of three warning screens skipped below one second each', () => {
    const service = new WarningDwellSignalBuildingService();

    expect(
      service.build([
        observation('warning_shown', 0),
        observation('warning_confirmed', 600),
        observation('warning_shown', 2000),
        observation('warning_confirmed', 2500),
        observation('warning_shown', 4000),
        observation('warning_confirmed', 4700),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'warning_dwell',
        confidence: 1,
        reasonCodes: ['warning_skip_series_three_fast_confirmations'],
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 65,
        maxContribution: 65,
        reasonCodes: ['warning_skip_series_block_floor'],
      }),
    ]);
  });

  it('allows confirmations at the exact dwell threshold and ignores unmatched events', () => {
    const service = new WarningDwellSignalBuildingService();

    expect(
      service.build([
        observation('warning_scrolled', 100),
        observation('warning_shown', 1000),
        observation('warning_confirmed', 2000),
      ]),
    ).toEqual([]);
  });
});

function observation(
  kind: WarningDwellObservationEntity['kind'],
  atMs: number,
): WarningDwellObservationEntity {
  return {
    kind,
    atMs,
  };
}
