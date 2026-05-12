import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ScenarioCatalogParsingService } from '../../../src/application/services/ScenarioCatalogParsingService';

describe('ScenarioCatalogParsingService', () => {
  it('parses all factor, visual, session, and composite scenarios from the PRD catalog', () => {
    const service = new ScenarioCatalogParsingService();
    const markdown = fs.readFileSync(
      path.resolve(__dirname, '../../../../../prd/Scenarios_Catalog_v0.3.md'),
      'utf8',
    );

    const catalog = service.parse(markdown);

    expect(catalog.scenarios).toHaveLength(340);
    expect(catalog.composites).toHaveLength(10);
    expect(catalog.scenarios[0]).toMatchObject({
      id: 'CPY-01',
      factor: 'copy_paste_recipient',
      type: 'TP',
      normalizedVerdict: 'step_up',
      tier: 'LIVE',
    });
    expect(catalog.composites[0]).toMatchObject({
      id: 'C1',
      normalizedVerdict: 'block',
    });
  });

  it('ignores markdown table headers and non-scenario rows', () => {
    const service = new ScenarioCatalogParsingService();
    const markdown = [
      '## 1. `copy_paste_recipient` (weight 40)',
      '| # | Type | Сценарий | Verdict |',
      '|---|---|---|---|',
      '| 1 | TP | Paste recipient | step_up |',
      '',
      'plain text',
    ].join('\n');

    const catalog = service.parse(markdown);

    expect(catalog.scenarios).toHaveLength(1);
    expect(catalog.scenarios[0].id).toBe('CPY-01');
  });
});
