import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';
import type { WarningDwellObservationEntity } from '../../domain/warning/entities/WarningDwellObservationEntity';

const WARNING_MIN_DWELL_MS = 1000;
const WARNING_SKIP_SERIES_COUNT = 3;
const WARNING_SINGLE_SKIP_CONFIDENCE = 0.9;
const WARNING_SERIES_SKIP_CONFIDENCE = 1;
const WARNING_STEP_UP_BOOST_CONTRIBUTION = 42;
const WARNING_BLOCK_BOOST_CONTRIBUTION = 65;

type FastWarningSkip = {
  dwellMs: number;
  hasScroll: boolean;
};

export class WarningDwellSignalBuildingService {
  build(observations: WarningDwellObservationEntity[]): RiskSignalEntity[] {
    const fastSkips = this.fastWarningSkips(observations);
    if (fastSkips.length === 0) return [];
    if (fastSkips.length >= WARNING_SKIP_SERIES_COUNT) return this.seriesSignals(fastSkips);
    return this.singleSkipSignals(fastSkips);
  }

  private singleSkipSignals(fastSkips: FastWarningSkip[]): RiskSignalEntity[] {
    const reasonCodes = ['warning_dwell_too_short'];
    if (fastSkips.some((skip) => !skip.hasScroll)) {
      reasonCodes.push('warning_no_scroll_dwell_too_short');
    }

    return [
      this.warningSignal(reasonCodes, WARNING_SINGLE_SKIP_CONFIDENCE, fastSkips),
      this.boostSignal(
        WARNING_STEP_UP_BOOST_CONTRIBUTION,
        'warning_skip_step_up_floor',
        fastSkips,
      ),
    ];
  }

  private seriesSignals(fastSkips: FastWarningSkip[]): RiskSignalEntity[] {
    return [
      this.warningSignal(
        ['warning_skip_series_three_fast_confirmations'],
        WARNING_SERIES_SKIP_CONFIDENCE,
        fastSkips,
      ),
      this.boostSignal(
        WARNING_BLOCK_BOOST_CONTRIBUTION,
        'warning_skip_series_block_floor',
        fastSkips,
      ),
    ];
  }

  private warningSignal(
    reasonCodes: string[],
    confidence: number,
    fastSkips: FastWarningSkip[],
  ): RiskSignalEntity {
    return {
      kind: 'warning_dwell',
      detected: true,
      confidence,
      reasonCodes,
      source: 'live',
      metadata: this.metadata(fastSkips),
    };
  }

  private boostSignal(
    contribution: number,
    reasonCode: string,
    fastSkips: FastWarningSkip[],
  ): RiskSignalEntity {
    return {
      kind: 'composite_risk_boost',
      detected: true,
      contribution,
      maxContribution: contribution,
      reasonCodes: [reasonCode],
      source: 'live',
      metadata: this.metadata(fastSkips),
    };
  }

  private metadata(fastSkips: FastWarningSkip[]): Record<string, unknown> {
    return {
      fastSkipCount: fastSkips.length,
      minimumDwellMs: WARNING_MIN_DWELL_MS,
      fastestDwellMs: Math.min(...fastSkips.map((skip) => skip.dwellMs)),
      noScrollCount: fastSkips.filter((skip) => !skip.hasScroll).length,
    };
  }

  private fastWarningSkips(observations: WarningDwellObservationEntity[]): FastWarningSkip[] {
    const sortedObservations = [...observations].sort((left, right) => left.atMs - right.atMs);
    const shownEvents = sortedObservations.filter((observation) => observation.kind === 'warning_shown');

    return shownEvents
      .map((shownEvent, index) => this.fastWarningSkip(sortedObservations, shownEvent, shownEvents[index + 1]))
      .filter((skip): skip is FastWarningSkip => skip !== null);
  }

  private fastWarningSkip(
    observations: WarningDwellObservationEntity[],
    shownEvent: WarningDwellObservationEntity,
    nextShownEvent?: WarningDwellObservationEntity,
  ): FastWarningSkip | null {
    const confirmedEvent = observations.find((observation) => (
      observation.kind === 'warning_confirmed' &&
      observation.atMs >= shownEvent.atMs &&
      (nextShownEvent === undefined || observation.atMs < nextShownEvent.atMs)
    ));
    if (confirmedEvent === undefined) return null;

    const dwellMs = confirmedEvent.atMs - shownEvent.atMs;
    if (dwellMs >= WARNING_MIN_DWELL_MS) return null;

    return {
      dwellMs,
      hasScroll: observations.some((observation) => (
        observation.kind === 'warning_scrolled' &&
        observation.atMs >= shownEvent.atMs &&
        observation.atMs <= confirmedEvent.atMs
      )),
    };
  }
}
