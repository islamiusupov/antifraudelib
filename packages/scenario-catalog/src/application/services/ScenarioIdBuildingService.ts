import { SCENARIO_GROUPS } from '../../domain/constants/ScenarioGroups';

export class ScenarioIdBuildingService {
  build(prefix: string, number: number): string {
    return `${prefix}-${number < 10 ? '0' : ''}${number}`;
  }

  buildExpectedIds(): string[] {
    const ids: string[] = [];
    for (const group of SCENARIO_GROUPS) {
      for (let index = 0; index < group.expectedCount; index += 1) {
        ids.push(this.build(group.prefix, index + 1));
      }
    }
    return ids;
  }
}
