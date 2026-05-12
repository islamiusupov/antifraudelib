import { useCallback } from 'react';
import type { DBankObservedEventEntity } from '@deepcode/antifraud-dbank-adapter';
import {
  useDeepFraud,
  type BrowserApiInterceptionEventEntity,
  type LiveInteractionEventEntity,
} from '@deepcode/antifraud-react';
import type { RiskAssessmentEntity, RiskFactorEntity } from '@deepcode/antifraud-core';

type TimedEventEntity<TEvent extends { atMs: number; kind: string }> = {
  event: TEvent;
  receivedAtMs: number;
};

type ActivityExportEventSource = 'd-bank' | 'iframe-live' | 'iframe-browser-api';

export type ActivityExportPanelProps = {
  observedEvents: Array<TimedEventEntity<DBankObservedEventEntity>>;
  iframeLiveEvents: Array<TimedEventEntity<LiveInteractionEventEntity>>;
  iframeBrowserApiEvents: Array<TimedEventEntity<BrowserApiInterceptionEventEntity>>;
  clockMs: number;
  windowMs: number;
};

export type ActivityExportEntity = {
  exportedAt: string;
  windowMs: number;
  windowStart: string;
  windowEnd: string;
  assessment: RiskAssessmentEntity;
  factors: RiskFactorEntity[];
  events: ActivityExportEventEntity[];
  totalRecordedEventCount: number;
};

export type ActivityExportEventEntity = {
  source: ActivityExportEventSource;
  kind: string;
  eventAtMs: number;
  receivedAtMs: number;
  receivedAt: string;
  metadata?: Record<string, unknown>;
  allowed?: boolean;
};

export function ActivityExportPanel({
  observedEvents,
  iframeLiveEvents,
  iframeBrowserApiEvents,
  clockMs,
  windowMs,
}: ActivityExportPanelProps) {
  const { assessment, factors } = useDeepFraud();
  const exportActivity = useCallback(
    (format: 'json' | 'pdf') => {
      const activity = buildActivityExport({
        assessment,
        factors,
        observedEvents,
        iframeLiveEvents,
        iframeBrowserApiEvents,
        clockMs,
        windowMs,
      });
      const timestamp = compactIsoTimestamp(activity.exportedAt);
      if (format === 'json') {
        downloadBlob(
          new Blob([JSON.stringify(activity, null, 2)], { type: 'application/json;charset=utf-8' }),
          `deepfraud-activity-${timestamp}.json`,
        );
        return;
      }

      downloadBlob(
        new Blob([buildActivityPdf(activity)], { type: 'application/pdf' }),
        `deepfraud-activity-${timestamp}.pdf`,
      );
    },
    [assessment, clockMs, factors, iframeBrowserApiEvents, iframeLiveEvents, observedEvents, windowMs],
  );

  return (
    <div className="deepfraud-activity-export" aria-label="Activity export">
      <button onClick={() => exportActivity('json')} type="button">
        JSON
      </button>
      <button onClick={() => exportActivity('pdf')} type="button">
        PDF
      </button>
    </div>
  );
}

export function buildActivityExport({
  assessment,
  factors,
  observedEvents,
  iframeLiveEvents,
  iframeBrowserApiEvents,
  clockMs,
  windowMs,
}: ActivityExportPanelProps & {
  assessment: RiskAssessmentEntity;
  factors: RiskFactorEntity[];
}): ActivityExportEntity {
  const windowStartMs = clockMs - windowMs;
  const events = [
    ...mapEvents('d-bank', observedEvents),
    ...mapEvents('iframe-live', iframeLiveEvents),
    ...mapEvents('iframe-browser-api', iframeBrowserApiEvents),
  ]
    .filter((event) => event.receivedAtMs >= windowStartMs && event.receivedAtMs <= clockMs)
    .sort((left, right) => left.receivedAtMs - right.receivedAtMs);

  return {
    exportedAt: new Date().toISOString(),
    windowMs,
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(clockMs).toISOString(),
    assessment,
    factors,
    events,
    totalRecordedEventCount: observedEvents.length + iframeLiveEvents.length + iframeBrowserApiEvents.length,
  };
}

function mapEvents<TEvent extends { atMs: number; kind: string }>(
  source: ActivityExportEventSource,
  events: Array<TimedEventEntity<TEvent>>,
): ActivityExportEventEntity[] {
  return events.map(({ event, receivedAtMs }) => {
    const record = event as Record<string, unknown>;
    const metadata = record.metadata;
    const allowed = record.allowed;

    return {
      source,
      kind: event.kind,
      eventAtMs: event.atMs,
      receivedAtMs,
      receivedAt: new Date(receivedAtMs).toISOString(),
      ...(isRecord(metadata) ? { metadata } : {}),
      ...(typeof allowed === 'boolean' ? { allowed } : {}),
    };
  });
}

export function buildActivityPdf(activity: ActivityExportEntity): string {
  const lines = [
    'DeepCode Antifraud Activity Report',
    `Exported: ${activity.exportedAt}`,
    `Window: ${activity.windowStart} - ${activity.windowEnd}`,
    `Score: ${activity.assessment.score}`,
    `Decision: ${activity.assessment.decision.level}`,
    `Active factors: ${activity.factors.length}`,
    `Events in window: ${activity.events.length}`,
    '',
    'Factors',
    ...activity.factors.map((factor) =>
      `${factor.kind}: ${factor.contribution}/${factor.maxContribution ?? factor.contribution} ${factor.reasonCodes?.join(', ') ?? ''}`,
    ),
    '',
    'Reasons',
    ...activity.assessment.decision.reasons.map((reason) =>
      `${reason.factorKind}: ${reason.code} +${reason.contribution}`,
    ),
    '',
    'Events',
    ...activity.events.map((event) => {
      const metadata = event.metadata === undefined ? '' : ` ${JSON.stringify(event.metadata)}`;
      return `${event.receivedAt} [${event.source}] ${event.kind}${metadata}`;
    }),
  ];

  return buildTextPdf(lines);
}

function buildTextPdf(lines: string[]): string {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 40;
  const startY = 752;
  const lineHeight = 14;
  const linesPerPage = Math.floor((startY - 40) / lineHeight);
  const pages = chunkLines(wrapPdfLines(lines), linesPerPage);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    const stream = buildPdfTextStream(pageLines, marginX, startY, lineHeight);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  return serializePdf(objects);
}

function buildPdfTextStream(lines: string[], x: number, y: number, lineHeight: number): string {
  return [
    'BT',
    '/F1 10 Tf',
    `${x} ${y} Td`,
    `${lineHeight} TL`,
    ...lines.map((line, index) => `${index === 0 ? '' : 'T*\n'}(${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');
}

function serializePdf(objects: string[]): string {
  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(byteLength(chunks.join('')));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = byteLength(chunks.join(''));
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${leftPad(String(offset), 10, '0')} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return chunks.join('');
}

function wrapPdfLine(line: string, maxLength = 92): string[] {
  if (line.length <= maxLength) return [line];
  const words = line.split(' ');
  const wrappedLines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine === '' ? word : `${currentLine} ${word}`;
    if (nextLine.length <= maxLength) {
      currentLine = nextLine;
      return;
    }
    if (currentLine !== '') wrappedLines.push(currentLine);
    currentLine = word;
  });

  if (currentLine !== '') wrappedLines.push(currentLine);
  return wrappedLines;
}

function wrapPdfLines(lines: string[]): string[] {
  const wrappedLines: string[] = [];
  lines.forEach((line) => {
    wrapPdfLine(toPdfSafeText(line)).forEach((wrappedLine) => wrappedLines.push(wrappedLine));
  });
  return wrappedLines;
}

function chunkLines(lines: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function toPdfSafeText(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, '?');
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function byteLength(value: string): number {
  return value.length;
}

function leftPad(value: string, targetLength: number, fill: string): string {
  let paddedValue = value;
  while (paddedValue.length < targetLength) {
    paddedValue = `${fill}${paddedValue}`;
  }
  return paddedValue;
}

function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function compactIsoTimestamp(value: string): string {
  return value.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
