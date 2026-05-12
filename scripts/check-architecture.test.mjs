import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import checker from './check-architecture.cjs';

const { runArchitectureCheck } = checker;

describe('check-architecture', () => {
  it('accepts mirrored tests outside src', () => {
    const root = createTempProject({
      'packages/example/src/application/services/RiskScoringService.ts': 'export class RiskScoringService {}',
      'packages/example/test/application/services/RiskScoringService.test.ts': '',
    });

    expect(runArchitectureCheck(root)).toEqual([]);
  });

  it('rejects tests inside src and missing mirrored tests', () => {
    const root = createTempProject({
      'packages/example/src/application/services/RiskScoringService.ts': 'export class RiskScoringService {}',
      'packages/example/src/application/services/RiskScoringService.test.ts': '',
    });

    expect(runArchitectureCheck(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Test file must not be inside src'),
        expect.stringContaining('Missing mirrored test'),
      ]),
    );
  });

  it('rejects dto directories and invalid service names', () => {
    const root = createTempProject({
      'packages/example/src/application/dto/ExampleDto.ts': 'export type ExampleDto = {}',
      'packages/example/src/application/services/RiskService.ts': 'export class RiskService {}',
      'packages/example/test/application/services/RiskService.test.ts': '',
    });

    expect(runArchitectureCheck(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Directory must be named dtos'),
        expect.stringContaining('Service file must include an -ing action'),
      ]),
    );
  });

  it('rejects entity files and exports without Entity suffix', () => {
    const root = createTempProject({
      'packages/example/src/domain/entities/BankAccount.ts': 'export type BankAccount = {}',
    });

    expect(runArchitectureCheck(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Entity file must end with Entity'),
        expect.stringContaining('Entity export must end with Entity'),
      ]),
    );
  });

  it('rejects domain imports from outer layers and D-bank references in react package', () => {
    const root = createTempProject({
      'packages/example/src/domain/entities/FraudEntity.ts': "import '../application/services/BadService';",
      'packages/react/src/application/services/RiskScoringService.ts': "import 'd-bank';",
      'packages/react/test/application/services/RiskScoringService.test.ts': '',
    });

    expect(runArchitectureCheck(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Domain must not import outer layer'),
        expect.stringContaining('React package must not import or mention D-bank'),
      ]),
    );
  });
});

function createTempProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-check-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
  return root;
}
