const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK_ROOTS = ['packages', 'apps'];
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.idea', '.npm-cache']);

function runArchitectureCheck(root = ROOT) {
  const errors = [];
  const files = listFiles(root, CHECK_ROOTS);

  ensureNoTestsInSrc(files, errors);
  ensureNoDtoDirectory(root, errors);
  ensureSourceFilesHaveMirroredTests(files, errors);
  ensureServiceNaming(files, errors);
  ensureDomainImportsPointInward(files, errors);
  ensureReactDoesNotImportDbank(files, errors);

  return errors;
}

function listFiles(root, relativeRoots) {
  const results = [];
  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    walk(absoluteRoot, results);
  }
  return results;
}

function walk(currentPath, results) {
  const stat = fs.statSync(currentPath);
  if (stat.isDirectory()) {
    if (IGNORED_DIRS.has(path.basename(currentPath))) return;
    for (const child of fs.readdirSync(currentPath)) {
      walk(path.join(currentPath, child), results);
    }
    return;
  }
  results.push(currentPath);
}

function ensureNoTestsInSrc(files, errors) {
  for (const file of files) {
    const normalized = normalize(file);
    if (normalized.includes('/src/') && /\.test\.[tj]sx?$/.test(normalized)) {
      errors.push(`Test file must not be inside src: ${relative(file)}`);
    }
  }
}

function ensureNoDtoDirectory(root, errors) {
  for (const relativeRoot of CHECK_ROOTS) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    for (const directory of listDirectories(absoluteRoot)) {
      if (path.basename(directory) === 'dto') {
        errors.push(`Directory must be named dtos, not dto: ${relative(directory)}`);
      }
    }
  }
}

function listDirectories(root) {
  const directories = [];
  function visit(currentPath) {
    if (!fs.statSync(currentPath).isDirectory()) return;
    if (IGNORED_DIRS.has(path.basename(currentPath))) return;
    directories.push(currentPath);
    for (const child of fs.readdirSync(currentPath)) {
      visit(path.join(currentPath, child));
    }
  }
  visit(root);
  return directories;
}

function ensureSourceFilesHaveMirroredTests(files, errors) {
  const fileSet = new Set(files.map(normalize));
  for (const file of files) {
    const normalized = normalize(file);
    if (!normalized.includes('/src/')) continue;
    if (!/\.[tj]sx?$/.test(normalized)) continue;
    if (/\.test\.[tj]sx?$/.test(normalized)) continue;
    if (normalized.endsWith('/index.ts') || normalized.endsWith('/index.tsx')) continue;
    if (normalized.includes('/domain/entities/') || normalized.includes('/domain/value-objects/')) continue;
    if (normalized.includes('/domain/constants/')) continue;

    const expectedTest = normalized
      .replace('/src/', '/test/')
      .replace(/\.tsx?$/, '.test.ts');
    const expectedTsxTest = normalized
      .replace('/src/', '/test/')
      .replace(/\.tsx?$/, '.test.tsx');

    if (!fileSet.has(expectedTest) && !fileSet.has(expectedTsxTest)) {
      errors.push(`Missing mirrored test for ${relative(file)}. Expected ${relative(expectedTest)}`);
    }
  }
}

function ensureServiceNaming(files, errors) {
  for (const file of files) {
    const normalized = normalize(file);
    if (!normalized.includes('/src/') || !normalized.includes('/services/')) continue;
    if (!/\.[tj]sx?$/.test(normalized)) continue;
    const basename = path.basename(file).replace(/\.[tj]sx?$/, '');
    if (!basename.endsWith('Service')) {
      errors.push(`Service file must end with Service: ${relative(file)}`);
    }
    if (!basename.includes('ing')) {
      errors.push(`Service file must include an -ing action: ${relative(file)}`);
    }
  }
}

function ensureDomainImportsPointInward(files, errors) {
  for (const file of files) {
    const normalized = normalize(file);
    if (!normalized.includes('/src/domain/')) continue;
    if (!/\.[tj]sx?$/.test(normalized)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const imports = extractImportSpecifiers(content);
    for (const importSpecifier of imports) {
      if (
        importSpecifier.includes('/application/') ||
        importSpecifier.includes('/adapters/') ||
        importSpecifier.includes('/infrastructure/') ||
        importSpecifier.includes('/presentation/')
      ) {
        errors.push(`Domain must not import outer layer ${importSpecifier}: ${relative(file)}`);
      }
    }
  }
}

function ensureReactDoesNotImportDbank(files, errors) {
  for (const file of files) {
    const normalized = normalize(file);
    if (!normalized.includes('/packages/react/src/')) continue;
    if (!/\.[tj]sx?$/.test(normalized)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('dbank') || content.includes('d-bank')) {
      errors.push(`React package must not import or mention D-bank: ${relative(file)}`);
    }
  }
}

function extractImportSpecifiers(content) {
  const imports = [];
  const importRegex = /import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function normalize(filePath) {
  return filePath.replace(/\\/g, '/');
}

function relative(filePath) {
  return normalize(path.relative(ROOT, filePath));
}

if (require.main === module) {
  const errors = runArchitectureCheck();
  if (errors.length > 0) {
    console.error('Architecture check failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log('Architecture check OK.');
}

module.exports = {
  runArchitectureCheck,
};
