import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ScenarioCatalogParsingService } from '@deepcode/antifraud-scenario-catalog';
import { BankActionScenarioRecognizingService } from '../../../src/application/services/BankActionScenarioRecognizingService';
import type { BankActionEntity } from '../../../src/domain/entities/BankActionEntity';

describe('BankActionScenarioRecognizingService', () => {
  it('recognizes copy-paste recipient scenarios from D-bank action traces', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('bank_opened', 0),
        action('transfer_opened', 100),
        action('recipient_pasted', 300),
        action('transfer_submitted', 900),
      ],
      catalog(),
    );

    expect(result.status).toBe('recognized');
    expect(result.recognitions[0]).toMatchObject({
      factor: 'copy_paste_recipient',
      confidence: 1,
      candidateScenarioIds: expect.arrayContaining(['CPY-01', 'CPY-20']),
    });
    expect(result.riskSignals[0]).toMatchObject({
      kind: 'copy_paste_recipient',
      detected: true,
      confidence: 1,
      reasonCodes: ['copy_paste_recipient'],
    });
  });

  it('recognizes multiple factors from one bank trace', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('bank_opened', 0),
        action('media_active', 50),
        action('transfer_opened', 100),
        action('recipient_created', 200),
        action('warning_shown', 400),
        action('warning_confirmed', 900),
        action('transfer_submitted', 1000),
      ],
      catalog(),
    );

    expect(result.recognitions.map((recognition) => recognition.factor)).toEqual([
      'concurrent_media',
      'new_recipient',
      'warning_dwell',
    ]);
    expect(result.riskSignals.map((signal) => signal.kind)).toEqual([
      'concurrent_media',
      'new_recipient',
      'warning_dwell',
    ]);
  });

  it('returns no_match for traces without suspicious bank actions', () => {
    const service = new BankActionScenarioRecognizingService();

    expect(service.recognize([action('bank_opened', 0), action('transfer_opened', 100)], catalog())).toMatchObject({
      status: 'no_match',
      recognitions: [],
      riskSignals: [],
    });
  });
});

function catalog() {
  return new ScenarioCatalogParsingService().parse(
    readFileSync(join(process.cwd(), 'prd', 'Scenarios_Catalog_v0.3.md'), 'utf8'),
  );
}

function action(kind: BankActionEntity['kind'], atMs: number): BankActionEntity {
  return { kind, atMs };
}
