import { SCENARIO_GROUPS } from '../../domain/constants/ScenarioGroups';
import type { CatalogScenarioEntity } from '../../domain/entities/CatalogScenarioEntity';
import type { CompositeScenarioEntity } from '../../domain/entities/CompositeScenarioEntity';
import type { ParsedScenarioCatalogEntity } from '../../domain/entities/ParsedScenarioCatalogEntity';
import type { ScenarioGroupEntity } from '../../domain/entities/ScenarioGroupEntity';
import type { ScenarioType } from '../../domain/value-objects/ScenarioType';
import { MarkdownTableRowParsingService } from './MarkdownTableRowParsingService';
import { ScenarioIdBuildingService } from './ScenarioIdBuildingService';
import { ScenarioVerdictNormalizingService } from './ScenarioVerdictNormalizingService';

export class ScenarioCatalogParsingService {
  private readonly groupByFactor = new Map(SCENARIO_GROUPS.map((group) => [group.factor, group]));

  constructor(
    private readonly markdownTableRowParsingService = new MarkdownTableRowParsingService(),
    private readonly scenarioIdBuildingService = new ScenarioIdBuildingService(),
    private readonly scenarioVerdictNormalizingService = new ScenarioVerdictNormalizingService(),
  ) {}

  parse(markdown: string): ParsedScenarioCatalogEntity {
    const scenarios: CatalogScenarioEntity[] = [];
    const composites: CompositeScenarioEntity[] = [];
    const unknownGroups = new Set<string>();
    let currentGroup: ScenarioGroupEntity | null = null;
    let inCompositeSection = false;

    for (const rawLine of markdown.split(/\r?\n/)) {
      const line = rawLine.trim();
      const factorHeading = line.match(/^##\s+\d+\.\s+`([^`]+)`/);
      const visualHeading = line.match(/^##\s+Visual Challenge Scenarios/);
      const compositeHeading = line.match(/^##\s+Композитные SEIP-сценарии/);

      if (factorHeading) {
        const factor = factorHeading[1];
        currentGroup = this.groupByFactor.get(factor) ?? null;
        inCompositeSection = false;
        if (!currentGroup) unknownGroups.add(factor);
        continue;
      }

      if (visualHeading) {
        currentGroup = this.groupByFactor.get('visual_challenge') ?? null;
        inCompositeSection = false;
        continue;
      }

      if (compositeHeading) {
        currentGroup = null;
        inCompositeSection = true;
        continue;
      }

      if (!line.startsWith('|') || line.startsWith('|---')) continue;

      if (inCompositeSection) {
        this.tryAppendCompositeScenario(line, composites);
        continue;
      }

      if (currentGroup) {
        this.tryAppendCatalogScenario(line, currentGroup, scenarios);
      }
    }

    return {
      scenarios,
      composites,
      groups: SCENARIO_GROUPS.filter((group) => !unknownGroups.has(group.factor)),
    };
  }

  private tryAppendCompositeScenario(line: string, composites: CompositeScenarioEntity[]): void {
    const cells = this.markdownTableRowParsingService.parse(line);
    if (cells.length < 4 || cells[0] === '#') return;

    const id = cells[0].trim();
    if (!/^C\d+$/.test(id)) return;

    composites.push({
      id,
      title: cells[1],
      combo: cells[2].split('+').map((part) => part.trim()).filter(Boolean),
      expectedVerdict: cells[3],
      normalizedVerdict: this.scenarioVerdictNormalizingService.normalize(cells[3]),
    });
  }

  private tryAppendCatalogScenario(
    line: string,
    currentGroup: ScenarioGroupEntity,
    scenarios: CatalogScenarioEntity[],
  ): void {
    const cells = this.markdownTableRowParsingService.parse(line);
    if (cells.length < 4 || cells[0] === '#') return;

    const number = Number(cells[0]);
    const type = cells[1] as ScenarioType;
    if (!Number.isInteger(number) || !this.isScenarioType(type)) return;

    scenarios.push({
      id: this.scenarioIdBuildingService.build(currentGroup.prefix, number),
      factor: currentGroup.factor,
      prefix: currentGroup.prefix,
      number,
      type,
      scenario: cells[2],
      verdict: cells[3],
      normalizedVerdict: this.scenarioVerdictNormalizingService.normalize(cells[3]),
      kind: currentGroup.kind,
      tier: currentGroup.tier,
    });
  }

  private isScenarioType(type: string): type is ScenarioType {
    return type === 'TP' || type === 'TN' || type === 'EDGE' || type === 'COMP';
  }
}
