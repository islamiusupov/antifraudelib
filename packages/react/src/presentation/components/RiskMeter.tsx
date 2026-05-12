import { useEffect, useMemo, useState } from 'react';
import type { RiskDecisionLevel } from '@deepcode/antifraud-core';
import { useDeepFraud } from '../hooks/useDeepFraud';

const DEFAULT_HISTORY_WINDOW_MS = 60_000;
const DEFAULT_SAMPLE_INTERVAL_MS = 1_000;
const CHART_WIDTH = 320;
const CHART_HEIGHT = 72;

export type RiskMeterHistoryPointEntity = {
  atMs: number;
  score: number;
  decisionLevel?: RiskDecisionLevel;
};

export type RiskMeterProps = {
  className?: string;
  showScore?: boolean;
  showHistory?: boolean;
  historyWindowMs?: number;
  sampleIntervalMs?: number;
  history?: RiskMeterHistoryPointEntity[];
  now?: () => number;
};

export function RiskMeter({
  className,
  showScore = true,
  showHistory = true,
  historyWindowMs = DEFAULT_HISTORY_WINDOW_MS,
  sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
  history,
  now = Date.now,
}: RiskMeterProps) {
  const { assessment } = useDeepFraud();
  const normalizedHistoryWindowMs = normalizePositiveNumber(historyWindowMs, DEFAULT_HISTORY_WINDOW_MS);
  const normalizedSampleIntervalMs = normalizePositiveNumber(sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS);
  const [internalHistory, setInternalHistory] = useState<RiskMeterHistoryPointEntity[]>(() => [
    createHistoryPoint(assessment.score, assessment.decision.level, now()),
  ]);
  const classNames = ['deepfraud-risk-meter', className].filter(Boolean).join(' ');
  const visibleHistory = useMemo(
    () =>
      buildVisibleHistory({
        history: history ?? internalHistory,
        currentPoint: createHistoryPoint(assessment.score, assessment.decision.level, now()),
        windowMs: normalizedHistoryWindowMs,
      }),
    [assessment.decision.level, assessment.score, history, internalHistory, normalizedHistoryWindowMs, now],
  );
  const chart = useMemo(
    () => buildChartPaths(visibleHistory, normalizedHistoryWindowMs),
    [normalizedHistoryWindowMs, visibleHistory],
  );

  useEffect(() => {
    if (history !== undefined) return undefined;

    const appendCurrentPoint = () => {
      setInternalHistory((currentHistory) =>
        trimHistory(
          [...currentHistory, createHistoryPoint(assessment.score, assessment.decision.level, now())],
          now(),
          normalizedHistoryWindowMs,
        ),
      );
    };

    appendCurrentPoint();

    if (normalizedSampleIntervalMs <= 0) return undefined;
    const interval = window.setInterval(appendCurrentPoint, normalizedSampleIntervalMs);
    return () => window.clearInterval(interval);
  }, [
    assessment.decision.level,
    assessment.score,
    history,
    normalizedHistoryWindowMs,
    normalizedSampleIntervalMs,
    now,
  ]);

  return (
    <div
      className={classNames}
      data-decision={assessment.decision.level}
      aria-label={`Risk score ${assessment.score}`}
    >
      <div className="deepfraud-risk-meter__summary">
        <div className="deepfraud-risk-meter__track" aria-hidden="true">
          <div className="deepfraud-risk-meter__fill" style={{ width: `${assessment.score}%` }} />
        </div>
        {showScore ? <strong className="deepfraud-risk-meter__score">{assessment.score}</strong> : null}
      </div>
      {showHistory ? (
        <div
          className="deepfraud-risk-meter__history"
          data-history-window-ms={normalizedHistoryWindowMs}
          data-history-point-count={visibleHistory.length}
        >
          <svg
            className="deepfraud-risk-meter__chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`Risk history for ${Math.round(normalizedHistoryWindowMs / 1000)} seconds`}
            preserveAspectRatio="none"
          >
            <path className="deepfraud-risk-meter__chart-area" d={chart.areaPath} />
            <path className="deepfraud-risk-meter__chart-line" d={chart.linePath} />
            {chart.points.map((point) => (
              <circle
                className="deepfraud-risk-meter__chart-point"
                cx={point.x}
                cy={point.y}
                data-score={point.score}
                data-at-ms={point.atMs}
                key={`${point.atMs}:${point.score}`}
                r="2.5"
              />
            ))}
          </svg>
          <div className="deepfraud-risk-meter__axis" aria-hidden="true">
            <span>{formatWindowLabel(normalizedHistoryWindowMs)}</span>
            <span>now</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type BuildVisibleHistoryOptions = {
  history: RiskMeterHistoryPointEntity[];
  currentPoint: RiskMeterHistoryPointEntity;
  windowMs: number;
};

type ChartPointEntity = RiskMeterHistoryPointEntity & {
  x: number;
  y: number;
};

function createHistoryPoint(score: number, decisionLevel: RiskDecisionLevel, atMs: number): RiskMeterHistoryPointEntity {
  return {
    atMs,
    decisionLevel,
    score: normalizeScore(score),
  };
}

function buildVisibleHistory({
  history,
  currentPoint,
  windowMs,
}: BuildVisibleHistoryOptions): RiskMeterHistoryPointEntity[] {
  const historyWithCurrentPoint = appendIfChanged(history, currentPoint);
  const latestAtMs = Math.max(...historyWithCurrentPoint.map((point) => point.atMs), currentPoint.atMs);
  const trimmedHistory = trimHistory(historyWithCurrentPoint, latestAtMs, windowMs);

  if (trimmedHistory.length > 0) return trimmedHistory;
  return [currentPoint];
}

function appendIfChanged(
  history: RiskMeterHistoryPointEntity[],
  point: RiskMeterHistoryPointEntity,
): RiskMeterHistoryPointEntity[] {
  const lastPoint = history[history.length - 1];
  if (
    lastPoint !== undefined &&
    lastPoint.score === point.score &&
    lastPoint.decisionLevel === point.decisionLevel &&
    lastPoint.atMs === point.atMs
  ) {
    return history;
  }
  return [...history, point];
}

function trimHistory(
  history: RiskMeterHistoryPointEntity[],
  latestAtMs: number,
  windowMs: number,
): RiskMeterHistoryPointEntity[] {
  const startAtMs = latestAtMs - windowMs;
  return history
    .filter((point) => Number.isFinite(point.atMs) && point.atMs >= startAtMs && point.atMs <= latestAtMs)
    .map((point) => ({
      ...point,
      score: normalizeScore(point.score),
    }))
    .sort((left, right) => left.atMs - right.atMs);
}

function buildChartPaths(history: RiskMeterHistoryPointEntity[], windowMs: number): {
  areaPath: string;
  linePath: string;
  points: ChartPointEntity[];
} {
  const latestAtMs = Math.max(...history.map((point) => point.atMs));
  const startAtMs = latestAtMs - windowMs;
  const points = history.map((point) => toChartPoint(point, startAtMs, windowMs));

  if (points.length === 0) {
    return {
      areaPath: '',
      linePath: '',
      points: [],
    };
  }

  if (points.length === 1) {
    const point = points[0];
    return {
      areaPath: `M 0 ${point.y} L ${CHART_WIDTH} ${point.y} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`,
      linePath: `M 0 ${point.y} L ${CHART_WIDTH} ${point.y}`,
      points: [
        {
          ...point,
          x: CHART_WIDTH,
        },
      ],
    };
  }

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return {
    areaPath: `${linePath} L ${lastPoint.x} ${CHART_HEIGHT} L ${firstPoint.x} ${CHART_HEIGHT} Z`,
    linePath,
    points,
  };
}

function toChartPoint(point: RiskMeterHistoryPointEntity, startAtMs: number, windowMs: number): ChartPointEntity {
  const relativePosition = windowMs <= 0 ? 1 : (point.atMs - startAtMs) / windowMs;
  const x = roundChartNumber(CHART_WIDTH * clamp(relativePosition, 0, 1));
  const y = roundChartNumber(CHART_HEIGHT - CHART_HEIGHT * (normalizeScore(point.score) / 100));

  return {
    ...point,
    score: normalizeScore(point.score),
    x,
    y,
  };
}

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.round(clamp(score, 0, 100));
}

function normalizePositiveNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundChartNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatWindowLabel(windowMs: number): string {
  const seconds = Math.round(windowMs / 1000);
  if (seconds < 60) return `-${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `-${minutes}m`;
}
