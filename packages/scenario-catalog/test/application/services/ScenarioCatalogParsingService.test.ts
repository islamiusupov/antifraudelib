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

  it('ignores unknown factor groups and malformed scenario rows', () => {
    const service = new ScenarioCatalogParsingService();
    const markdown = [
      '## 1. `unknown_factor` (weight 10)',
      '| 1 | TP | Unknown factor row | block |',
      '',
      '## 2. `copy_paste_recipient` (weight 40)',
      '| nope | TP | Not numeric | block |',
      '| 2 | UNKNOWN | Unknown type | block |',
      '| 3 | EDGE | Browser text with escaped a\\|b marker | monitor |',
    ].join('\n');

    const catalog = service.parse(markdown);

    expect(catalog.scenarios).toEqual([
      expect.objectContaining({
        id: 'CPY-03',
        type: 'EDGE',
        scenario: 'Browser text with escaped a|b marker',
        normalizedVerdict: 'monitor',
      }),
    ]);
    expect(catalog.groups.some((group) => group.factor === 'unknown_factor')).toBe(false);
  });

  it('parses composite rows with trimmed combo ids and skips malformed composite rows', () => {
    const service = new ScenarioCatalogParsingService();
    const markdown = [
      '## Композитные SEIP-сценарии',
      '| # | Название | Combo факторов | Expected verdict |',
      '|---|---|---|---|',
      '| C1 | Composite one | CPY-01 +  NRC-02 + | block (visual challenge) |',
      '| X1 | Not a composite id | CPY-01 | block |',
      '| C2 | Too short |',
    ].join('\n');

    const catalog = service.parse(markdown);

    expect(catalog.composites).toEqual([
      {
        id: 'C1',
        title: 'Composite one',
        combo: ['CPY-01', 'NRC-02'],
        expectedVerdict: 'block (visual challenge)',
        normalizedVerdict: 'block',
      },
    ]);
  });
});
