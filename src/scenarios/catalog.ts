export type ScenarioType = 'TP' | 'TN' | 'EDGE' | 'COMP';

export type ScenarioTier = 'LIVE' | 'MOCK' | 'PAPER' | 'VISUAL' | 'SESSION';

export type ScenarioKind = 'factor' | 'visual' | 'session';

export type ScenarioVerdict = 'allow' | 'monitor' | 'step_up' | 'block' | 'continue' | 'varies' | 'edge';

export type ScenarioGroup = {
  factor: string;
  prefix: string;
  kind: ScenarioKind;
  tier: ScenarioTier;
  expectedCount: number;
};

export type CatalogScenario = {
  id: string;
  factor: string;
  prefix: string;
  number: number;
  type: ScenarioType;
  scenario: string;
  verdict: string;
  normalizedVerdict: ScenarioVerdict;
  kind: ScenarioKind;
  tier: ScenarioTier;
};

export type CompositeScenario = {
  id: string;
  title: string;
  combo: string[];
  expectedVerdict: string;
  normalizedVerdict: ScenarioVerdict;
};

export type ParsedScenarioCatalog = {
  scenarios: CatalogScenario[];
  composites: CompositeScenario[];
  groups: ScenarioGroup[];
};

export type ScenarioCatalogValidation = {
  valid: boolean;
  expectedScenarioCount: number;
  actualScenarioCount: number;
  expectedCompositeCount: number;
  actualCompositeCount: number;
  missingIds: string[];
  duplicateIds: string[];
  unknownGroups: string[];
};

export const SCENARIO_GROUPS: ScenarioGroup[] = [
  { factor: 'copy_paste_recipient', prefix: 'CPY', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'new_recipient', prefix: 'NRC', kind: 'factor', tier: 'MOCK', expectedCount: 20 },
  { factor: 'concurrent_media', prefix: 'CMD', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'warning_dwell', prefix: 'WDW', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'keystroke_dynamics', prefix: 'KST', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'pointer_pattern', prefix: 'PTR', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'native_tampering', prefix: 'NTV', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'dev_environment', prefix: 'DEV', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'bot_detection', prefix: 'BOT', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'phishing_text_dom', prefix: 'PTD', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'phishing_url', prefix: 'PUL', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'page_visibility', prefix: 'PGV', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'recent_token_injection', prefix: 'TKN', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'visual_challenge', prefix: 'VIS', kind: 'visual', tier: 'VISUAL', expectedCount: 20 },
  { factor: 'client_environment', prefix: 'ENV', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'environment_conflicts', prefix: 'CNF', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'device_fingerprint', prefix: 'DFP', kind: 'session', tier: 'SESSION', expectedCount: 20 },
];

const GROUP_BY_FACTOR = new Map(SCENARIO_GROUPS.map((group) => [group.factor, group]));
const GROUP_BY_PREFIX = new Map(SCENARIO_GROUPS.map((group) => [group.prefix, group]));

export function buildScenarioId(prefix: string, number: number): string {
  return `${prefix}-${number < 10 ? '0' : ''}${number}`;
}

export function expectedScenarioIds(): string[] {
  const ids: string[] = [];
  for (const group of SCENARIO_GROUPS) {
    for (let index = 0; index < group.expectedCount; index += 1) {
      ids.push(buildScenarioId(group.prefix, index + 1));
    }
  }
  return ids;
}

export function parseScenariosCatalog(markdown: string): ParsedScenarioCatalog {
  const scenarios: CatalogScenario[] = [];
  const composites: CompositeScenario[] = [];
  const unknownGroups = new Set<string>();
  let currentGroup: ScenarioGroup | null = null;
  let inCompositeSection = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const factorHeading = line.match(/^##\s+\d+\.\s+`([^`]+)`/);
    const visualHeading = line.match(/^##\s+Visual Challenge Scenarios/);
    const compositeHeading = line.match(/^##\s+Композитные SEIP-сценарии/);

    if (factorHeading) {
      const factor = factorHeading[1];
      currentGroup = GROUP_BY_FACTOR.get(factor) ?? null;
      inCompositeSection = false;
      if (!currentGroup) unknownGroups.add(factor);
      continue;
    }

    if (visualHeading) {
      currentGroup = GROUP_BY_FACTOR.get('visual_challenge') ?? null;
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
      const cells = parseMarkdownRow(line);
      if (cells.length < 4 || cells[0] === '#') continue;
      const id = cells[0].trim();
      if (!/^C\d+$/.test(id)) continue;
      composites.push({
        id,
        title: cells[1],
        combo: cells[2].split('+').map((part) => part.trim()).filter(Boolean),
        expectedVerdict: cells[3],
        normalizedVerdict: normalizeVerdict(cells[3]),
      });
      continue;
    }

    if (!currentGroup) continue;

    const cells = parseMarkdownRow(line);
    if (cells.length < 4 || cells[0] === '#') continue;

    const number = Number(cells[0]);
    const type = cells[1] as ScenarioType;
    if (!Number.isInteger(number) || !isScenarioType(type)) continue;

    scenarios.push({
      id: buildScenarioId(currentGroup.prefix, number),
      factor: currentGroup.factor,
      prefix: currentGroup.prefix,
      number,
      type,
      scenario: cells[2],
      verdict: cells[3],
      normalizedVerdict: normalizeVerdict(cells[3]),
      kind: currentGroup.kind,
      tier: currentGroup.tier,
    });
  }

  return {
    scenarios,
    composites,
    groups: SCENARIO_GROUPS.filter((group) => !unknownGroups.has(group.factor)),
  };
}

export function validateScenarioCatalog(catalog: ParsedScenarioCatalog): ScenarioCatalogValidation {
  const expectedIds = expectedScenarioIds();
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const scenario of catalog.scenarios) {
    if (seen.has(scenario.id)) duplicateIds.add(scenario.id);
    seen.add(scenario.id);
  }

  const missingIds = expectedIds.filter((id) => !seen.has(id));
  const knownPrefixes = new Set(SCENARIO_GROUPS.map((group) => group.prefix));
  const unknownGroups = Array.from(new Set(
    catalog.scenarios
      .map((scenario) => scenario.prefix)
      .filter((prefix) => !knownPrefixes.has(prefix)),
  ));

  return {
    valid:
      missingIds.length === 0 &&
      duplicateIds.size === 0 &&
      unknownGroups.length === 0 &&
      catalog.scenarios.length === expectedIds.length &&
      catalog.composites.length === 10,
    expectedScenarioCount: expectedIds.length,
    actualScenarioCount: catalog.scenarios.length,
    expectedCompositeCount: 10,
    actualCompositeCount: catalog.composites.length,
    missingIds,
    duplicateIds: Array.from(duplicateIds).sort(),
    unknownGroups,
  };
}

export function getScenarioById(catalog: ParsedScenarioCatalog, id: string): CatalogScenario | undefined {
  return catalog.scenarios.find((scenario) => scenario.id === id);
}

export function getScenarioGroupByPrefix(prefix: string): ScenarioGroup | undefined {
  return GROUP_BY_PREFIX.get(prefix);
}

function parseMarkdownRow(row: string): string[] {
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isScenarioType(type: string): type is ScenarioType {
  return type === 'TP' || type === 'TN' || type === 'EDGE' || type === 'COMP';
}

function normalizeVerdict(verdict: string): ScenarioVerdict {
  const normalized = verdict.toLowerCase();
  if (normalized.includes('step_up')) return 'step_up';
  if (normalized.includes('block')) return 'block';
  if (normalized.includes('monitor')) return 'monitor';
  if (normalized.includes('allow')) return 'allow';
  if (normalized.includes('continue')) return 'continue';
  if (normalized.includes('varies')) return 'varies';
  return 'edge';
}
