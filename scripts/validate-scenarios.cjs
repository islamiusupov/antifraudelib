const fs = require('fs');
const path = require('path');
const {
  parseScenariosCatalog,
  validateScenarioCatalog,
} = require('../dist');

const catalogPath = path.resolve(__dirname, '..', 'prd', 'Scenarios_Catalog_v0.3.md');
const markdown = fs.readFileSync(catalogPath, 'utf8');
const catalog = parseScenariosCatalog(markdown);
const validation = validateScenarioCatalog(catalog);

if (!validation.valid) {
  console.error('Scenario catalog validation failed:');
  console.error(JSON.stringify(validation, null, 2));
  process.exit(1);
}

console.log(
  `Scenario catalog OK: ${validation.actualScenarioCount}/${validation.expectedScenarioCount} scenarios, ` +
    `${validation.actualCompositeCount}/${validation.expectedCompositeCount} composite scenarios.`,
);
