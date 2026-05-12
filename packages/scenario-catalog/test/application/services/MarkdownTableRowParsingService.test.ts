import { describe, expect, it } from 'vitest';
import { MarkdownTableRowParsingService } from '../../../src/application/services/MarkdownTableRowParsingService';

describe('MarkdownTableRowParsingService', () => {
  it('parses a markdown table row into trimmed cells', () => {
    const service = new MarkdownTableRowParsingService();

    expect(service.parse('| 1 | TP | Scenario | step_up |')).toEqual([
      '1',
      'TP',
      'Scenario',
      'step_up',
    ]);
  });

  it('keeps empty cells when the source row contains them', () => {
    const service = new MarkdownTableRowParsingService();

    expect(service.parse('| 1 |  | Scenario | allow |')).toEqual([
      '1',
      '',
      'Scenario',
      'allow',
    ]);
  });

  it('parses rows without border pipes and keeps escaped pipes inside cells', () => {
    const service = new MarkdownTableRowParsingService();

    expect(service.parse(' 1 | EDGE | text with a\\|b value | monitor ')).toEqual([
      '1',
      'EDGE',
      'text with a|b value',
      'monitor',
    ]);
  });
});
